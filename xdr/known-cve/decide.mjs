// 독립 실행형 알려진 취약점 판정기. 파일·네트워크 접근 없음.
const PATTERNS = [
  { name: 'jndi-lookup-in-header', field: 'useragent', evidence: 'CVE-2021-44228 원격 조회 구문이 요청 머리글에 나타남' },
  { name: 'jndi-lookup-in-parameter', field: 'url', evidence: 'MITRE ATT&CK T1190: 공개 서비스 취약점 악용의 URL 인자 형태' },
];
function hasLookup(value) {
  if (typeof value !== 'string') return false;
  const start = '$' + '{' + 'jndi:';
  const index = value.toLowerCase().indexOf(start);
  if (index < 0) return false;
  const tail = value.slice(index + start.length).toLowerCase();
  return ['ldap://', 'ldaps://', 'rmi://', 'dns://'].some(prefix => tail.startsWith(prefix) && tail.includes('}'));
}
export function decide(alert) {
  const data = alert?.data ?? {};
  const rule = alert?.rule ?? {};
  const matches = PATTERNS.filter(pattern => hasLookup(data[pattern.field]));
  const level = Number.isFinite(rule.level) ? rule.level : 0;
  const description = typeof rule.description === 'string' ? rule.description : '';
  let confidence = 0.05;
  let reason = 'no-known-cve-pattern';
  if (matches.length) {
    confidence = matches.length > 1 ? 0.99 : level >= 10 ? 0.95 : 0.9;
    reason = matches.map(pattern => pattern.name).join(', ');
  } else if (description.includes('CVE-2021-44228') && level >= 9) {
    confidence = 0.6;
    reason = 'jndi-lookup-in-header / jndi-lookup-in-parameter: incomplete evidence';
  } else if ((description.includes('원격 조회 구문') || description.includes('취약점 점검')) && level >= 9) {
    confidence = 0.52;
    reason = 'jndi-lookup-in-header / jndi-lookup-in-parameter: unconfirmed indicator';
  }
  return { action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record', confidence, reason };
}
