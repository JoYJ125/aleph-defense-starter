// 확인용 읽기 모듈입니다. decide.mjs 는 이 파일을 불러오지 않습니다.
// 원본 경보는 읽기만 하고, 비밀값처럼 보이는 문자열은 [가림]으로 바꿔 출력합니다.
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = join(root, 'xdr', 'fixtures', 'brute-force.json');

const SECRET_PATTERNS = [
  /\b(password|passwd|pwd|token|secret|api[_-]?key|authorization|bearer)\b\s*[:=]?\s*\S+/gi,
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]*/g,
  /\b(sk|pk|sb|ghp|gho|xox[a-z])[_-][\w-]{12,}/gi,
  /\b[A-Fa-f0-9]{32,}\b/g,
  /\b[A-Za-z0-9+/_-]{40,}={0,2}/g,
];

export function redact(value) {
  let text = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, '[가림]');
  return text;
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
  const raw = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const rows = await readAlerts();
  for (const r of rows) {
    console.log([r.time, r.srcip || '-', r.account || '-', `level=${r.level ?? '-'}`, r.description].join(' | '));
  }
  const same = raw.alerts.length === rows.length;
  console.log(`경보 ${raw.alerts.length}건, 뽑은 줄 ${rows.length}줄: ${same ? '일치' : '불일치'}`);
  if (!same) process.exitCode = 1;
}
