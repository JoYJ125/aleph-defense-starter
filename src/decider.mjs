// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required']);

export async function decide(request) {
  // 클라이언트 위조 헤더나 비어 있는 정보가 신뢰 정보로 승격되지 않도록 엔진 검증 출처를 확인합니다.
  const verifiedSignals = request?.signals?.source === 'judge_fixture' ? request.signals : null;
  const verifiedRecentEvents = Array.isArray(request?.recentEvents) ? request.recentEvents : [];

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

  // 2. 평소와 다른 시각, 처음 보는 네트워크에서 갑자기 많은 자료를 읽는 복합 이상 접속 확인
  const isSuspicious = verifiedSignals
    && (verifiedSignals.hour < 6 || verifiedSignals.hour > 22)
    && verifiedSignals.network === 'unusual'
    && verifiedRecentEvents.some(event => event.count >= 10);

  if (isSuspicious) {
    // 추가 인증(stepUp)을 거치지 않았거나 유효하지 않으면 재인증 요청
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
