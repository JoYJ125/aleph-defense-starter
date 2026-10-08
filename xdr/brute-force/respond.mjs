// 차단 후보(block)만 거부 규칙 파일에 쌓고, 알림을 xdr/alerts.log 에 한 줄씩 남깁니다.
// decide.mjs 는 판단만 하고, 파일 쓰기는 이 파일만 합니다. src/decider.mjs 는 고치지 않습니다.
// 거부 규칙은 출발 주소 기준입니다. 판정기 요청 계약(docs/DECIDER_REQUEST.md)에는 출발 주소가 없어,
// 판정기가 이 파일을 읽어 실제로 막으려면 운영 엔진이 주소를 계약에 넣어 준 뒤에 연결해야 합니다.
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = join(root, 'xdr', 'fixtures', 'brute-force.json');
export const RULES_PATH = join(root, 'xdr', 'brute-force', 'deny-rules.json');
export const LOG_PATH = join(root, 'xdr', 'alerts.log');
export const TTL_MS = 60 * 60 * 1000;
const BLOCK_AT = 0.85;

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

// 내부망·루프백·링크로컬·미지정 주소는 정상 사용자일 수 있어 규칙으로 만들지 않습니다.
function isBlockableIp(ip) {
  if (typeof ip !== 'string' || !IPV4.test(ip)) return false;
  const [a, b] = ip.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  return true;
}

function clean(text) {
  return String(text ?? '').replace(/[\r\n|]+/g, ' ').trim();
}

export async function loadRules(path = RULES_PATH) {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    return Array.isArray(parsed.rules) ? parsed.rules : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// 저장소는 loadRules(now) / saveRules({live, added, now}) / appendLog(lines) 세 가지만 제공하면 됩니다.
// 파일 저장소는 로컬 실행용이고, Vercel 서버에서는 파일이 남지 않으므로 Supabase 저장소를 씁니다.
export function createFileStore({ rulesPath = RULES_PATH, logPath = LOG_PATH } = {}) {
  return {
    loadRules: () => loadRules(rulesPath),
    async saveRules({ live, added }) {
      await mkdir(dirname(rulesPath), { recursive: true });
      const tmp = `${rulesPath}.tmp`;
      await writeFile(tmp, `${JSON.stringify({ schema: 'aleph.xdr.deny-rules.v1', rules: [...live, ...added] }, null, 2)}\n`, 'utf8');
      await rename(tmp, rulesPath);
    },
    async appendLog(lines) {
      await mkdir(dirname(logPath), { recursive: true });
      await appendFile(logPath, `${lines.join('\n')}\n`, 'utf8');
    },
  };
}

// supabase 는 서버 전용 키로 만든 클라이언트입니다. 테이블은 docs/xdr-supabase.sql 로 만듭니다.
export function createSupabaseStore(supabase) {
  return {
    async loadRules(now) {
      const { data, error } = await supabase
        .from('xdr_deny_rules')
        .select('id,srcip,evidence_alert_id,confidence,reason,created_at,expires_at')
        .gt('expires_at', now.toISOString());
      if (error) throw new Error('xdr_rules_unavailable');
      return (data ?? []).map((r) => ({
        id: r.id,
        action: 'deny',
        srcip: r.srcip,
        evidenceAlertId: r.evidence_alert_id,
        confidence: Number(r.confidence),
        reason: r.reason,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
      }));
    },
    async saveRules({ added, now }) {
      const expired = await supabase.from('xdr_deny_rules').delete().lte('expires_at', now.toISOString());
      if (expired.error) throw new Error('xdr_rules_unavailable');
      if (!added.length) return;
      const { error } = await supabase.from('xdr_deny_rules').upsert(
        added.map((r) => ({
          id: r.id,
          srcip: r.srcip,
          evidence_alert_id: r.evidenceAlertId,
          confidence: r.confidence,
          reason: r.reason,
          created_at: r.createdAt,
          expires_at: r.expiresAt,
        })),
        { onConflict: 'id', ignoreDuplicates: true },
      );
      if (error) throw new Error('xdr_rules_unavailable');
    },
    async appendLog(lines) {
      const { error } = await supabase.from('xdr_alert_log').insert(lines.map((line) => ({ line })));
      if (error) throw new Error('xdr_log_unavailable');
    },
  };
}

export function isDenied(srcip, rules, now = new Date()) {
  return rules.some((r) => r.srcip === srcip && Date.parse(r.expiresAt) > now.getTime());
}

export async function respond(alerts, options = {}) {
  const now = options.now ?? new Date();
  const store = options.store ?? createFileStore({ rulesPath: options.rulesPath, logPath: options.logPath });
  const ttlMs = options.ttlMs ?? TTL_MS;

  const results = [];
  for (const alert of alerts) results.push({ alert, result: await decide(alert) });

  // 같은 주소에서 block 이 아닌 경보가 함께 보이면 정상 사용자가 섞였을 수 있어 규칙을 만들지 않습니다.
  const mixed = new Set(
    results.filter((x) => x.result.action !== 'block').map((x) => x.alert?.data?.srcip),
  );

  const live = (await store.loadRules(now)).filter((r) => Date.parse(r.expiresAt) > now.getTime());
  const added = [];
  const lines = [];

  for (const { alert, result } of results) {
    const id = clean(alert?.id) || 'unknown';
    const ip = alert?.data?.srcip;
    let status = result.action;

    if (result.action === 'block' && result.confidence >= BLOCK_AT) {
      if (!isBlockableIp(ip)) status = 'block-skipped(주소 부적합)';
      else if (mixed.has(ip)) status = 'block-skipped(같은 주소에 정상 경보)';
      else if (live.some((r) => r.srcip === ip) || added.some((r) => r.srcip === ip)) status = 'block-already';
      else {
        added.push({
          id: `bf.deny.${id}`,
          action: 'deny',
          srcip: ip,
          evidenceAlertId: id,
          confidence: result.confidence,
          reason: clean(result.reason),
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
        });
        status = 'block-rule-added';
      }
    }
    lines.push(
      [now.toISOString(), status, id, clean(ip) || '-', result.confidence.toFixed(2), clean(result.reason)].join(' | '),
    );
  }

  if (added.length) await store.saveRules({ live, added, now });
  if (lines.length) await store.appendLog(lines);

  return { results, added, lines };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const alerts = JSON.parse(await readFile(FIXTURE, 'utf8')).alerts;
  const useSupabase = process.argv.includes('--supabase');
  let store = createFileStore();
  if (useSupabase) {
    // 키는 환경변수로만 받고 출력하지 않습니다. Vercel 서버가 아니라 이 컴퓨터에서 실행할 때만 씁니다.
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      console.error('SUPABASE_URL, SUPABASE_SECRET_KEY 환경변수가 필요합니다. (값은 터미널에 직접 설정하고 파일·Git에는 넣지 않습니다.)');
      process.exit(1);
    }
    const { createClient } = await import('@supabase/supabase-js');
    store = createSupabaseStore(createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }));
  }
  const { results, added } = await respond(alerts, { store });
  const rules = await store.loadRules(new Date());
  const now = new Date();
  const blocked = results.filter(({ alert }) => isDenied(alert.data?.srcip, rules, now));
  const where = useSupabase ? 'Supabase 규칙 테이블' : '규칙 파일';
  console.log(`경보 ${alerts.length}건, 새 거부 규칙 ${added.length}건, ${where} 총 ${rules.length}건`);
  console.log(`막힌 경보 ${blocked.length}건, 통과 ${alerts.length - blocked.length}건`);
}
