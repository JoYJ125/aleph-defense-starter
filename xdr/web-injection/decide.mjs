// 패턴은 xdr/web-injection/patterns.json 을 옮겨 적은 값입니다. 이 파일은 다른 파일·패키지를 불러오지 않고,
// 파일을 읽거나 쓰지 않으며, 바깥에 묻지 않고 경보 하나만 보고 혼자 계산합니다.
// data.url 에는 문서용 표식만 있어 판정에 쓰지 않고, 설명·반복 횟수·규칙 수준·MITRE 표시로 판단합니다.
const PATTERNS = Object.freeze([
  {
    name: 'sql-fragment-in-request',
    attack: { id: 'T1190', name: 'Exploit Public-Facing Application' },
    condition: {
      description: '같은 출발 주소의 요청 인자에 SQL 구문 표기가 반복해서 들어 있습니다.',
      descriptionKeywords: ['SQL 구문', '데이터베이스 조회'],
      minCount: 5,
    },
    evidence: 'T1190: 공개된 웹사이트와 SQL 같은 데이터베이스의 취약점 악용이며, 흔한 웹 취약점은 OWASP Top 10·CWE Top 25 에 정리돼 있습니다.',
  },
  {
    name: 'script-tag-in-request',
    attack: { id: 'T1190', name: 'Exploit Public-Facing Application' },
    condition: {
      description: '같은 출발 주소의 요청 인자에 스크립트 삽입 표식이 반복해서 들어 있습니다.',
      descriptionKeywords: ['스크립트 삽입', '스크립트 표식'],
      minCount: 5,
    },
    evidence: 'T1190: 공개된 웹사이트의 취약점 악용이며, 흔한 웹 취약점은 OWASP Top 10·CWE Top 25 에 정리돼 있습니다.',
  },
  {
    name: 'path-traversal-repeat',
    attack: { id: 'T1190', name: 'Exploit Public-Facing Application' },
    condition: {
      description: '같은 출발 주소의 요청 인자에서 상위 경로로 거슬러 올라가는 표기(../)가 반복됩니다.',
      descriptionKeywords: ['거슬러 올라가는', '경로 이탈'],
      minCount: 5,
    },
    evidence: 'T1190: 공개된 웹 서버의 취약점 악용이며, 흔한 웹 취약점은 OWASP Top 10·CWE Top 25 에 정리돼 있습니다.',
  },
]);

const BLOCK_AT = 85;
const ALERT_AT = 50;
const MIN_COUNT = 5;
// 이름 있는 패턴은 아니지만 주입 표기를 가리키는 말입니다. 반복되면 알림, 한두 번이면 애매함으로 봅니다.
const OTHER_INJECTION_CUES = ['명령 구분자'];
const WEAK_CUES = ['따옴표', '이상한 검색', '주입처럼', '구분 문자'];

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function repeatCount(data, description) {
  const given = toNumber(data.count);
  if (given > 0) return given;
  const said = description.match(/(\d+)\s*(?:번|건)/);
  return said ? Number(said[1]) : 0;
}

export function decide(alert) {
  const data = alert && typeof alert.data === 'object' && alert.data ? alert.data : {};
  const rule = alert && typeof alert.rule === 'object' && alert.rule ? alert.rule : {};
  const description = typeof rule.description === 'string' ? rule.description : '';

  const count = repeatCount(data, description);
  const level = toNumber(rule.level);
  const mitre = Array.isArray(rule.mitre) ? rule.mitre : [];
  const hasT1190 = mitre.some((id) => typeof id === 'string' && id.startsWith('T1190'));

  const has = (words) => words.some((w) => description.includes(w));
  const keywordHits = PATTERNS.filter((p) => has(p.condition.descriptionKeywords));
  const fullHits = keywordHits.filter((p) => count >= p.condition.minCount);
  const otherInjection = has(OTHER_INJECTION_CUES);

  // 점수는 100 단위 정수로 계산해 소수 오차 없이 경계값(0.85, 0.5)을 비교합니다.
  let points = 0;
  let reason;
  if (fullHits.length) {
    points = 70 + (fullHits.length > 1 ? 10 : 0);
    reason = `${fullHits.map((p) => p.name).join(' + ')} 일치 (반복 ${count}건)`;
  } else if (otherInjection && count >= MIN_COUNT) {
    points = 55;
    reason = `이름 있는 패턴 없음, T1190 주입 표기 반복 ${count}건`;
  } else if (keywordHits.length) {
    points = 40;
    reason = `${keywordHits.map((p) => p.name).join(' + ')} 부분 일치 (반복 ${count}건 < ${keywordHits[0].condition.minCount})`;
  } else if (has(WEAK_CUES)) {
    points = 50;
    reason = `주입 의심 표기 약한 신호 (반복 ${count}건)`;
  } else {
    reason = '일치하는 패턴 없음';
  }

  if (points > 0) {
    if (level >= 10) points += 10;
    else if (level >= 5) points += 5;
    if (hasT1190) points += 10;
  }
  // 반복이 부족한 부분 일치와 약한 신호는 명확한 공격으로 올라가지 못하게 막습니다.
  if (!fullHits.length && !(otherInjection && count >= MIN_COUNT)) points = Math.min(points, BLOCK_AT - 5);
  points = Math.min(points, 100);

  const action = points >= BLOCK_AT ? 'block' : points >= ALERT_AT ? 'alert' : 'record';
  return { action, confidence: points / 100, reason };
}
