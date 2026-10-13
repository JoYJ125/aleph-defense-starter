// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required']);

export async function decide(request) {
  // 클라이언트 위조 헤더나 비어 있는 정보가 신뢰 정보로 승격되지 않도록 엔진 검증 출처를 구분합니다.
  // 출처가 없거나 'none'인 경우 불명확한 출처로 보며, 임의의 정상값으로 채우지 않습니다.
  const source = request?.signals?.source;
  const hasVerifiedSignalSource = typeof source === 'string' && source !== 'none' && source.length > 0;

  const verifiedSignals = hasVerifiedSignalSource ? {
    source,
    region: typeof request.signals.region === 'string' ? request.signals.region : null,
    network: typeof request.signals.network === 'string' ? request.signals.network : null,
    hour: typeof request.signals.hour === 'number' ? request.signals.hour : null,
  } : null;

  // 행동(recentEvents)이 배열이 아니거나 비어 있으면 그대로 두고 임의의 정상 사건으로 채우지 않습니다.
  const verifiedRecentEvents = Array.isArray(request?.recentEvents)
    ? request.recentEvents.filter(ev => ev && typeof ev === 'object' && typeof ev.count === 'number')
    : [];

  // 1. 기기 미등록 시 거부
  if (!request || request.deviceRegistered !== true) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request?.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 2. 평소와 다른 시각 + 처음 보는 네트워크 + 갑자기 많은 자료 읽기의 복합 이상 사건 확인
  // 지역(region) 하나만으로 영구 차단하지 않으며, 정해진 복합 이상 사건은 추가 확인(step_up)으로 보냅니다.
  const isSuspicious = verifiedSignals
    && typeof verifiedSignals.hour === 'number'
    && (verifiedSignals.hour < 6 || verifiedSignals.hour > 22)
    && verifiedSignals.network === 'unusual'
    && verifiedRecentEvents.some(event => event.count >= 10);

  if (isSuspicious) {
    const stepUpVerified = request?.stepUp?.verified === true
      && typeof request?.stepUp?.authAgeSeconds === 'number'
      && request.stepUp.authAgeSeconds <= 900;

    if (!stepUpVerified) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'step_up',
        reasonCode: 'step_up_required',
        ruleIds: ['step_up_required'],
      };
    }
  }

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['device_registered'],
  };
}
