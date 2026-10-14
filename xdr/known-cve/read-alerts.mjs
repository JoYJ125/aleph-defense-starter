// 확인 전용: decide.mjs와 독립적으로 수업용 Wazuh 경보를 읽습니다.
// 원본의 URL, user-agent, 헤더, 토큰, 비밀값은 출력하지 않습니다.
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'known-cve.json');

const SECRET_PATTERNS = [
  /\b(password|passwd|pwd|token|secret|api[_-]?key|authorization|bearer)\b\s*[:=]?\s*\S+/gi,
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]*/g,
  /\b(sk|pk|sb|ghp|gho|xox[a-z])[_-][\w-]{12,}/gi,
  /\b[A-Fa-f0-9]{32,}\b/g,
  /\b[A-Za-z0-9+/_-]{40,}={0,2}/g,
  /\$\{[^}]*\}/g,
];

export function redact(value) {
  let text = typeof value === 'string' ? value : '';
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, '[가림]');
  return text.replace(/[\r\n\t]+/g, ' ');
}

export function summarize(alert) {
  return {
    time: redact(alert?.timestamp),
    srcip: redact(alert?.data?.srcip),
    account: redact(alert?.data?.srcuser),
    level: Number.isFinite(alert?.rule?.level) ? alert.rule.level : null,
    description: redact(alert?.rule?.description),
  };
}

export async function readAlerts(path = FIXTURE) {
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(fixture.alerts)) throw new Error('alerts 배열이 없습니다.');
  return fixture.alerts.map(summarize);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const rows = await readAlerts();
  const original = JSON.parse(await readFile(FIXTURE, 'utf8'));
  for (const row of rows) {
    console.log([row.time || '-', row.srcip || '-', row.account || '-', 'level=' + (row.level ?? '-'), row.description || '-'].join(' | '));
  }
  const matches = original.alerts.length === rows.length;
  console.log('경보 ' + original.alerts.length + '건, 뽑은 줄 ' + rows.length + '줄: ' + (matches ? '일치' : '불일치'));
  if (!matches) process.exitCode = 1;
}
