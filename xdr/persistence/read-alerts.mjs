// 확인 전용 Wazuh 경보 요약기. decide.mjs와 독립적으로 동작합니다.
// 원본 경보는 읽기만 하며 경로, 실행 인자, 토큰 등 불필요한 원문을 출력하지 않습니다.
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'persistence.json');

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
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'persistence' || !Array.isArray(fixture.alerts)) {
    throw new Error('persistence 경보 묶음 형식이 아닙니다.');
  }
  return fixture.alerts.map(summarize);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const rows = await readAlerts();
  for (const row of rows) {
    console.log([row.time || '-', row.srcip || '-', row.account || '-', 'level=' + (row.level ?? '-'), row.description || '-'].join(' | '));
  }
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const matches = fixture.alerts.length === rows.length;
  console.log('경보 ' + fixture.alerts.length + '건, 뽑은 줄 ' + rows.length + '줄: ' + (matches ? '일치' : '불일치'));
  if (!matches) process.exitCode = 1;
}
