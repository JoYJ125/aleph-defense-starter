// 독립 실행형 지속성 판정기. patterns.json의 세 패턴을 내장하며 입출력·import 없음.
const PATTERNS = Object.freeze([
  { name: 'unsigned-new-service', technique: 'T1543', signals: ['서명 없는 새 서비스 등록', '서비스 실행 파일 변경과 서명 부재', '임시 폴더의 서비스 실행 파일'] },
  { name: 'unfamiliar-scheduled-task', technique: 'T1053', signals: ['낯선 예약 작업', '수업 시간 밖 실행', '임시 폴더 실행 파일', '무작위 작업 이름'] },
  { name: 'unfamiliar-startup-folder-change', technique: 'T1543', signals: ['평소 목록에 없는 시작 폴더 프로그램', '시작 프로그램과 예약 작업이 같은 임시 파일 참조'] },
]);

export function decide(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const path = typeof alert?.data?.path === 'string' ? alert.data.path.toLowerCase().replace(/\\/g, '/') : '';
  const level = Number.isFinite(alert?.rule?.level) ? alert.rule.level : 0;
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const temp = /\/temp\/|\/tmp\//.test(path);
  const service = mitre.includes(PATTERNS[0].technique) && /서비스/.test(description);
  const task = mitre.includes(PATTERNS[1].technique) && /예약 작업/.test(description);
  const startup = /시작 (폴더|프로그램|항목)/.test(description);
  let confidence = 0.05;
  let reason = 'no-persistence-pattern';

  if (service && (/서명 없|서명이 없/.test(description)) && (temp || /등록이 연속|실행 파일이 바뀌/.test(description))) {
    confidence = 0.95;
    reason = PATTERNS[0].name;
  } else if (service && /평소 목록에 없는 서비스/.test(description) && /등록/.test(description) && /다시 켜도/.test(description)) {
    confidence = 0.95;
    reason = PATTERNS[0].name;
  } else if (task && temp && (/처음 보는|임의 문자열/.test(description)) && /수업 시간 밖|임시 폴더/.test(description)) {
    confidence = 0.95;
    reason = PATTERNS[1].name;
  } else if (startup && /평소 목록에 없는 프로그램/.test(description) && /추가/.test(description)) {
    confidence = 0.9;
    reason = PATTERNS[2].name;
  } else if (startup && mitre.includes('T1543') && mitre.includes('T1053') && /같은 임시 파일/.test(description) && temp) {
    confidence = 0.95;
    reason = PATTERNS[2].name;
  } else if (level >= 5 && level <= 8 && (service || task || startup || /임시 폴더에 실행 파일/.test(description)) && (mitre.includes('T1543') || mitre.includes('T1053'))) {
    confidence = 0.55;
    reason = task ? PATTERNS[1].name : startup ? PATTERNS[2].name : PATTERNS[0].name;
  }
  return { action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record', confidence, reason };
}
