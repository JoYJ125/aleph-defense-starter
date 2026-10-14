// privilege XDR 로컬 거부 후보 어댑터. ZTNA 기존 판정기와 계약은 변경하지 않습니다.
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = join(ROOT, 'xdr', 'fixtures', 'privilege.json');
export const RULES_PATH = join(ROOT, 'xdr', 'privilege', 'deny-rules.json');
export const LOG_PATH = join(ROOT, 'xdr', 'alerts.log');
export const TTL_MS = 60 * 60 * 1000;
const safe = value => String(value ?? '').replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 100);
const ipValid = ip => typeof ip === 'string' && /^(?:(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])$/.test(ip);

export async function loadRules(path = RULES_PATH) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(value.rules)) throw new Error('invalid deny rules');
    return value.rules;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function isDenied(srcip, rules, now = new Date()) {
  return rules.some(r => r.action === 'deny' && r.srcip === srcip &&
    Number.isFinite(Date.parse(r.expiresAt)) && Date.parse(r.expiresAt) > now.getTime());
}

export async function respond(alerts, options = {}) {
  if (!Array.isArray(alerts)) throw new TypeError('alerts must be an array');
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? TTL_MS;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('invalid expiration');
  }
  const rulesPath = options.rulesPath ?? RULES_PATH;
  const logPath = options.logPath ?? LOG_PATH;
  const rows = alerts.map(alert => ({ alert, decision: decide(alert) }));
  // 출발 주소는 사용자 신원이 아닙니다. 정상 또는 불확실한 경보가 같은 주소에 있으면 IP 차단을 생략합니다.
  const mixed = new Set(rows.filter(x => x.decision.action !== 'block').map(x => x.alert?.data?.srcip));
  const previous = await loadRules(rulesPath);
  const live = previous.filter(r => Number.isFinite(Date.parse(r.expiresAt)) && Date.parse(r.expiresAt) > now.getTime());
  const added = [];
  const lines = [];
  for (const { alert, decision } of rows) {
    const id = safe(alert?.id) || 'unknown';
    const ip = alert?.data?.srcip;
    let status = decision.action;
    if (decision.action === 'block' && decision.confidence >= 0.85) {
      if (!ipValid(ip)) status = 'skipped-invalid-ip';
      else if (mixed.has(ip)) status = 'skipped-mixed-events';
      else if (isDenied(ip, [...live, ...added], now)) status = 'already-denied';
      else {
        added.push({
          id: 'pv.deny.' + id, action: 'deny', srcip: ip, evidenceAlertId: id,
          confidence: decision.confidence, reason: safe(decision.reason),
          createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
        });
        status = 'deny-rule-added';
      }
    }
    // 원본 설명, 계정, 토큰 및 경로는 로그에 기록하지 않습니다.
    lines.push([now.toISOString(), 'privilege:' + status, id, safe(ip) || '-', Number(decision.confidence).toFixed(2), safe(decision.reason)].join(' | '));
  }
  if (added.length || previous.length !== live.length) {
    await mkdir(dirname(rulesPath), { recursive: true });
    const temp = rulesPath + '.tmp';
    await writeFile(temp, JSON.stringify({ schema: 'aleph.xdr.deny-rules.v1', rules: [...live, ...added] }, null, 2) + '\n', 'utf8');
    await rename(temp, rulesPath);
  }
  if (lines.length) {
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, lines.join('\n') + '\n', 'utf8');
  }
  return { results: rows, added, lines };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const { results, added } = await respond(fixture.alerts);
  const rules = await loadRules();
  const normalBlocked = results.filter(x => x.decision.action === 'record' && isDenied(x.alert?.data?.srcip, rules));
  console.log('경보 ' + results.length + '건, 새 거부 규칙 ' + added.length + '건, 정상 경보 차단 ' + normalBlocked.length + '건');
  if (normalBlocked.length) process.exitCode = 1;
}
