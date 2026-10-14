const PATTERNS = Object.freeze([
  'unexpected-admin-group-membership',
  'unexpected-privileged-command',
  'off-hours-privileged-activity'
]);

export function decide(alert) {
  const d = String(alert?.rule?.description ?? '');
  const tags = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const level = Number(alert?.rule?.level ?? 0);
  const relevant = tags.includes('T1068') || tags.includes('T1078');
  const group = alert?.data?.group === 'administrators';
  const admin = group || (/관리자 그룹/.test(d) && !/아닙니다/.test(d));
  const command = /관리자 명령|권한 명령/.test(d);
  const unusual = /처음 보는|처음 봅니다|원격 주소|방금 관리자가 된|다른 계정의 권한|곧바로|평범한 계정|같은 주소에서 계정|1분 뒤|명령 실행이 같이/.test(d);
  const offHours = /수업 시간 밖|업무처럼 보이지 않는/.test(d);
  const elevated = /관리자 권한으로 바뀌/.test(d);
  let confidence = 0.05;
  let reason = 'no-privilege-pattern';
  if (relevant && level >= 9 && admin && /추가|들어가|들어왔/.test(d) && (unusual || Number(alert?.data?.count) >= 2)) {
    confidence = 0.95;
    reason = PATTERNS[0];
  } else if (relevant && level >= 9 && ((command && unusual) || (elevated && unusual))) {
    confidence = 0.95;
    reason = PATTERNS[1];
  } else if (relevant && level >= 9 && offHours && (command || admin) && unusual) {
    confidence = 0.95;
    reason = PATTERNS[2];
  } else if (relevant && level >= 5 && (admin || command || /권한 상승|그룹|계정 종류/.test(d))) {
    confidence = 0.55;
    reason = admin ? PATTERNS[0] : command ? PATTERNS[1] : PATTERNS[2];
  }
  return { action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record', confidence, reason };
}
