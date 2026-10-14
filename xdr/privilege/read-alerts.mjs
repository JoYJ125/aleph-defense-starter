// 확인 전용: 경보마다 허용된 다섯 필드만 출력하며 원본 파일은 변경하지 않습니다.
// decide.mjs와 독립적으로 실행합니다.
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'privilege.json');

// 자유 텍스트의 비밀값과 긴 인증 문자열은 가리고, 제어문자는 한 줄로 정리합니다.
export function redact(value) {
  let text = typeof value === 'string' ? value : '';
  text = text.replace(/[\r\n\t]+/g, ' ');
  text = text.replace(/\b(?:password|passwd|pwd|token|secret|api[_-]?key|authorization|bearer|private[_-]?key)\b\s*[:=]?\s*(?:"[^"]*"|'[^']*'|\S+)/gi, '[가림]');
  text = text.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]*)?\b/g, '[가림]');
  text = text.replace(/\b(?:ghp|gho|ghu|ghs|github_pat|sk|xox[a-z])[-_][A-Za-z0-9_-]{12,}\b/gi, '[가림]');
  text = text.replace(/\b[A-Fa-f0-9]{32,}\b/g, '[가림]');
  text = text.replace(/\b[A-Za-z0-9+/_-]{40,}={0,2}\b/g, '[가림]');
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
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'privilege' || !Array.isArray(fixture.alerts)) {
    throw new Error('privilege 경보 묶음 형식이 아닙니다.');
  }
  return fixture.alerts.map(summarize);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const rows = await readAlerts();
  for (const row of rows) {
    console.log([row.time || '-', row.srcip || '-', row.account || '-', 'level=' + (row.level ?? '-'), row.description || '-'].join(' | '));
  }
  const original = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const matches = original.alerts.length === rows.length;
  console.log('경보 ' + original.alerts.length + '건, 뽑은 줄 ' + rows.length + '줄: ' + (matches ? '일치' : '불일치'));
  if (!matches) process.exitCode = 1;
}
