// 9단계 로컬 탐지: 계약에 정의된 시각, 요청 종류, 가명 주체만 처리합니다.
// 기기 ID는 현재 사건 계약에 없으므로 추측하거나 권한을 변경하지 않습니다.
function readPracticeEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const { at, method, identity } = event;
  if (typeof at !== 'string') return null;
  const time = Date.parse(at);
  if (!Number.isFinite(time) || method !== 'GET') return null;
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) return null;
  const { sub } = identity;
  if (typeof sub !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(sub)) return null;
  return { time, subject: sub };
}

export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');

  const bySubject = new Map();
  for (const rawEvent of events) {
    const event = readPracticeEvent(rawEvent);
    if (!event) continue;
    if (!bySubject.has(event.subject)) bySubject.set(event.subject, []);
    bySubject.get(event.subject).push(event.time);
  }

  // 같은 가명 주체의 10분 이내 GET 121건 이상에 대해서만 제안합니다.
  // 이는 실행이 아닌 별도 탐지 결과이며 기기별 회수는 수행하지 않습니다.
  for (const [subject, times] of bySubject) {
    times.sort((a, b) => a - b);
    let start = 0;
    for (let end = 0; end < times.length; end++) {
      while (times[end] - times[start] > 600_000) start++;
      if (end - start + 1 > 120) {
        return { action: 'propose_revocation', reasonCode: 'burst_read', subject };
      }
    }
  }

  return { action: 'observe' };
}


// 운영 엔진이 검증한 복합 의심 신호에 대한 별도 제안입니다.
// 기기 식별자가 없거나 출처가 검증되지 않으면 회수 대상을 추측하지 않습니다.
// 접근 허용/거부를 반환하는 decide()와 실제 기기 권한은 변경하지 않습니다.
export function proposeRevocation(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return { action: 'observe' };
  const signals = request.signals;
  const source = signals?.source;
  const verified = typeof source === 'string' && source.length > 0
    && source !== 'none' && source !== 'unknown';
  const hour = signals?.hour;
  const unusualNetwork = signals?.network === 'unusual';
  const oddHour = Number.isInteger(hour) && (hour < 6 || hour > 22) && hour >= 0 && hour <= 23;
  const burst = Array.isArray(request.recentEvents) && request.recentEvents.some(
    event => event && typeof event === 'object'
      && event.kind === 'GET' && Number.isFinite(event.count) && event.count >= 10
  );
  // verifiedDeviceId는 운영 엔진이 확인해 전달한 가상 기기 식별자만 허용합니다.
  const deviceId = request.verifiedDeviceId;
  if (!verified || !unusualNetwork || !oddHour || !burst
      || typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(deviceId)) {
    return { action: 'observe' };
  }
  return { action: 'propose_revocation', reasonCode: 'compound_anomaly', deviceId };
}
