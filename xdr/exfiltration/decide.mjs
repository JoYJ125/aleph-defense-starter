// patterns.json의 세 패턴을 독립 실행용으로 내장합니다. 외부 입출력 없음.
const PATTERNS = Object.freeze([
  { name: 'unfamiliar-destination-bulk-transfer', techniques: ['T1041', 'T1048'], indicators: ['처음 보는 목적지', '대용량 자료 전송', '다량 파일 반출'] },
  { name: 'off-hours-archive-transfer', techniques: ['T1048'], indicators: ['수업·업무 시간 밖', '압축 파일', '낯선 외부 주소'] },
  { name: 'repeated-high-volume-egress', techniques: ['T1041', 'T1048'], indicators: ['동일 목적지', '대용량 반복 전송', '명령 통로 반복 전송'] },
]);

export function decide(alert) {
  const d = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const tags = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const level = Number(alert?.rule?.level);
  const bytes = Number(alert?.data?.bytes);
  const files = Number(alert?.data?.files);
  const count = Number(alert?.data?.count);
  const destination = typeof alert?.data?.dstip === 'string' && alert.data.dstip.length > 0;
  const tagged = tags.includes('T1041') || tags.includes('T1048');
  const unfamiliar = /처음 보는|평소에 쓰지 않던|외부 주소/.test(d);
  const bulk = Number.isFinite(bytes) && bytes >= 50000000;
  const manyFiles = Number.isFinite(files) && files >= 50;
  const repeated = Number.isFinite(count) && count >= 5;
  const archive = /압축 파일/.test(d);
  const offHours = /수업 시간 밖|업무 시간 밖/.test(d);
  const channel = /명령 통로/.test(d);
  const failed = /실패|전송은 아직 없습니다|파일 전송은 없습니다/.test(d);
  let confidence = 0.05;
  let reason = 'no-exfiltration-pattern';

  if (tagged && destination && !failed && level >= 10 && bulk) {
    if (offHours && archive && unfamiliar) {
      confidence = 0.95; reason = PATTERNS[1].name;
    } else if (repeated && (/같은 목적지|명령 통로/.test(d) || offHours)) {
      confidence = 0.95; reason = PATTERNS[2].name;
    } else if (unfamiliar || manyFiles || /자료실 전체|메모 묶음|연속 전송|연속으로|목적지 두 곳/.test(d)) {
      confidence = 0.95; reason = PATTERNS[0].name;
    } else if (offHours && repeated) {
      confidence = 0.95; reason = PATTERNS[2].name;
    }
  }
  if (confidence < 0.5 && tagged && level >= 5) {
    confidence = 0.55;
    reason = offHours && archive ? PATTERNS[1].name : channel || repeated ? PATTERNS[2].name : PATTERNS[0].name;
  }
  return {
    action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record',
    confidence,
    reason,
  };
}
