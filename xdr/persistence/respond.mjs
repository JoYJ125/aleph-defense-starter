// 지속성 차단 후보를 만료형 로컬 거부 규칙으로 연결하는 독립 어댑터.
// 현재 SDP 판정 계약에는 srcip가 없으므로 운영 ZTNA 엔진에 직접 적용되지 않습니다.
// src/decider.mjs와 decide.mjs는 변경하지 않습니다.
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = join(ROOT, 'xdr', 'fixtures', 'persistence.json');
export const RULES_PATH = join(ROOT, 'xdr', 'persistence', 'deny-rules.json');
export const LOG_PATH = join(ROOT, 'xdr', 'alerts.log');
export const TTL_MS = 60 * 60 * 1000;

function safe(value) {
  return String(value ?? '').replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 100);
}
function validIp(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
export async function loadRules(path = RULES_PATH) {
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    if (data.schema !== 'aleph.xdr.deny-rules.v1' || !Array.isArray(data.rules)) throw new Error('거부 규칙 형식 오류');
    return data.rules;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
export function isDenied(srcip, rules, now = new Date()) {
  return rules.some(rule => rule.action === 'deny' && rule.srcip === srcip &&
    Number.isFinite(Date.parse(rule.expiresAt)) && Date.parse(rule.expiresAt) > now.getTime());
}
export async function respond(alerts, options = {}) {
  if (!Array.isArray(alerts)) throw new TypeError('경보 배열이 필요합니다');
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? TTL_MS;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('만료 설정 오류');
  }
  const rulesPath = options.rulesPath ?? RULES_PATH;
  const logPath = options.logPath ?? LOG_PATH;
  const results = await Promise.all(alerts.map(async alert => ({ alert, decision: await decide(alert) })));
  // 같은 IP에 정상 또는 미확정 사건이 있으면 IP 전체 차단을 만들지 않습니다.
  const mixedIps = new Set(results.filter(row => row.decision.action !== 'block').map(row => row.alert?.data?.srcip));
  const previous = await loadRules(rulesPath);
  const live = previous.filter(rule => Number.isFinite(Date.parse(rule.expiresAt)) && Date.parse(rule.expiresAt) > now.getTime());
  const added = [];
  const lines = [];
  for (const { alert, decision } of results) {
    const id = safe(alert?.id) || 'unknown';
    const ip = alert?.data?.srcip;
    let status = decision.action;
    if (decision.action === 'block' && decision.confidence >= 0.85) {
      if (!validIp(ip)) status = 'skipped-invalid-ip';
      else if (mixedIps.has(ip)) status = 'skipped-mixed-events';
      else if (isDenied(ip, [...live, ...added], now)) status = 'already-denied';
      else {
        added.push({
          id: 'ps.deny.' + id,
          action: 'deny',
          srcip: ip,
          evidenceAlertId: id,
          confidence: decision.confidence,
          reason: safe(decision.reason),
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
        });
        status = 'deny-rule-added';
      }
    }
    // 민감정보가 담길 수 있는 설명·경로·원본 페이로드는 로그에 남기지 않습니다.
    lines.push([now.toISOString(), 'persistence:' + status, id, safe(ip) || '-', Number(decision.confidence).toFixed(2), safe(decision.reason)].join(' | '));
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
  return { results, added, lines };
}
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const { results, added } = await respond(fixture.alerts);
  const rules = await loadRules();
  const blocked = results.filter(row => isDenied(row.alert?.data?.srcip, rules));
  const normalBlocked = blocked.filter(row => row.decision.action === 'record');
  console.log('경보 ' + results.length + '건, 추가 거부 규칙 ' + added.length + '건, 차단 대상 ' + blocked.length + '건, 정상 경보 차단 ' + normalBlocked.length + '건');
  if (normalBlocked.length) process.exitCode = 1;
}
