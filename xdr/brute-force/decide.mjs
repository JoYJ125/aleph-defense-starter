// 패턴은 xdr/brute-force/patterns.json 을 옮겨 적은 값입니다. 이 파일은 다른 파일·패키지를 불러오지 않고,
// 파일을 읽거나 쓰지 않으며, 바깥에 묻지 않고 경보 하나만 보고 혼자 계산합니다.
const PATTERNS = Object.freeze([
  {
    name: 'same-source-repeated-failures',
    attack: { id: 'T1110.001', name: 'Password Guessing' },
    condition: {
      description: '같은 출발 주소가 짧은 시간에 로그인 실패를 연속으로 쌓습니다.',
      fields: ['data.srcip', 'data.count', 'rule.description'],
      minCount: 10,
    },
    evidence: 'T1110.001: 비밀번호를 모르는 공격자가 반복적·순차적 방식으로 비밀번호를 추측해 인증 실패가 다수 생깁니다.',
  },
  {
    name: 'many-accounts-same-password',
    attack: { id: 'T1110.003', name: 'Password Spraying' },
    condition: {
      description: '같은 출발 주소가 여러 계정에 같은 비밀번호(소수의 흔한 비밀번호)로 로그인을 시도합니다.',
      fields: ['data.srcip', 'data.accounts', 'rule.description'],
      minAccounts: 5,
    },
    evidence: 'T1110.003: 하나 또는 소수의 흔한 비밀번호를 여러 계정에 시도해, 한 계정에 여러 비밀번호를 넣을 때 생기는 잠금을 피합니다.',
  },
]);

const BLOCK_AT = 85;
const ALERT_AT = 50;
const WEAK_COUNT = 3;

const FAILURES = PATTERNS[0];
const SPRAY = PATTERNS[1];

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function countAccounts(data, description) {
  const raw = data.accounts;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const listed = new Set(list.map((a) => String(a).trim()).filter(Boolean)).size;
  const said = description.match(/계정\s*(\d+)\s*개/);
  return Math.max(listed, said ? Number(said[1]) : 0);
}

export function decide(alert) {
  const data = alert && typeof alert.data === 'object' && alert.data ? alert.data : {};
  const rule = alert && typeof alert.rule === 'object' && alert.rule ? alert.rule : {};
  const description = typeof rule.description === 'string' ? rule.description : '';

  const count = toNumber(data.count);
  const accounts = countAccounts(data, description);
  const level = toNumber(rule.level);
  const mitre = Array.isArray(rule.mitre) ? rule.mitre : [];

  const failureHit = count >= FAILURES.condition.minCount;
  const sprayHit = accounts >= SPRAY.condition.minAccounts;

  // 점수는 100 단위 정수로 계산해 소수 오차 없이 경계값(0.85, 0.5)을 비교합니다.
  let points = 0;
  if (failureHit) points = 70;
  else if (count >= WEAK_COUNT) points = 40;
  else if (count >= 1) points = 15;
  if (sprayHit) points = Math.max(points, 70);
  if (failureHit && sprayHit) points += 10;

  if (points > 0) {
    if (level >= 10) points += 10;
    else if (level >= 5) points += 5;
    if (mitre.some((id) => typeof id === 'string' && id.startsWith('T1110'))) points += 10;
  }
  points = Math.min(points, 100);

  const matched = [];
  if (failureHit) matched.push(FAILURES.name);
  if (sprayHit) matched.push(SPRAY.name);

  let reason;
  if (matched.length) reason = `${matched.join(' + ')} 일치 (실패 ${count}건, 계정 ${accounts}개)`;
  else if (points > 0) reason = `${FAILURES.name} 부분 일치 (실패 ${count}건 < ${FAILURES.condition.minCount})`;
  else reason = '일치하는 패턴 없음';

  const action = points >= BLOCK_AT ? 'block' : points >= ALERT_AT ? 'alert' : 'record';
  return { action, confidence: points / 100, reason };
}
