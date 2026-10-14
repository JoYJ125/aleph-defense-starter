// 9단계 가상 사건 계약: 시각, 요청 종류, 가명 사용자만 읽습니다.
// 검증된 사건만 전달해야 하며 브라우저가 주장하는 신원을 신뢰하지 않습니다.
function readPracticeEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const { at, method, identity } = event;
  if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) return null;
  if (typeof method !== 'string') return null;
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) return null;
  const { sub } = identity;
  if (typeof sub !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(sub)) return null;
  return { at, method, subject: sub };
}

export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  // 계약 외 속성(메모, 토큰, 실명 등)은 복사하거나 출력하지 않습니다.
  const safeEvents = events.map(readPracticeEvent);
  void safeEvents;
  // 이번 변경은 입력 처리만 담당합니다.
  return { action: 'observe' };
}
