// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required', 'zone_rules']);

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

  // 1. 기기 미등록 시 거부 (6단계 규칙)
  if (!request || request.deviceRegistered !== true) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request?.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 2. 평소와 다른 시각 + 처음 보는 네트워크 + 갑자기 많은 자료 읽기의 복합 이상 사건 확인 (7단계 규칙)
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

  // 3. 구역 규칙 (8단계): 공지·강사 자료 쓰기 전면 거부, 메모 전체 목록 경로 거부, 기능 경로 거부
  const pathStr = typeof request?.path === 'string' ? request.path.trim() : '';
  const segments = pathStr.split('/').filter(Boolean);
  const service = typeof request?.service === 'string' ? request.service.trim() : '';
  const route = typeof request?.route === 'string' ? request.route.trim() : '';
  const method = typeof request?.method === 'string' ? request.method.toUpperCase() : '';

  // 3-1. :id 위치 또는 경로에 export 등 기능 경로가 오면 거부
  const FUNCTIONAL_KEYWORDS = new Set(['export', 'import', 'download', 'upload', 'action', 'actions']);
  if (segments.some(seg => FUNCTIONAL_KEYWORDS.has(seg.toLowerCase())) || pathStr.includes('export')) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'route_not_allowed',
      ruleIds: ['zone_rules'],
    };
  }

  // 3-2. 자원 ID(Resource ID) 구분: 내 자료실 메모(notes) vs 강사 공지(notices)
  // 서버가 요청마다 서로 다른 자원 ID로 구별할 수 있도록 식별합니다.
  const isNoticeResource = service === 'notices' || service.includes('notice') || service.includes('announcement')
    || segments[0] === 'notices' || segments[0] === 'notice'
    || (segments[0] === 'api' && segments[1] === 'notices')
    || route.includes('/notices') || route.includes('/notice');

  const isInstructorResource = service.includes('instructor') || service.includes('teacher') || service.includes('admin')
    || pathStr.includes('instructor') || pathStr.includes('teacher') || pathStr.includes('admin')
    || route.includes('instructor') || route.includes('teacher') || route.includes('admin');

  // 강사 공지나 강사 자료 구역은 쓰기(POST·PUT·PATCH·DELETE)를 누구에게나 전면 거부
  if (isNoticeResource || isInstructorResource) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'deny',
        reasonCode: 'zone_not_allowed',
        ruleIds: ['zone_rules'],
      };
    }
  }

  // 3-3. 내 자료실 메모 자원 ID (notes)
  const isNotesResource = service === 'notes' || service === 'memos' || service === 'learning-memos'
    || segments[0] === 'notes' || segments[0] === 'memos'
    || (segments[0] === 'api' && (segments[1] === 'learning-memos' || segments[1] === 'notes'))
    || route.includes('/notes') || route.includes('/learning-memos');

  // 3-4. 메모 구역: 메모 전체 목록처럼 여러 사람의 자료를 한꺼번에 여는 경로 거부 (단건만 허용)
  // route에 :id가 없거나, path가 단건 식별자를 포함하지 않는 목록 조회 요청은 거부
  if (isNotesResource && method === 'GET') {
    const isSingleItem = route.includes(':id')
      || (segments[0] === 'notes' && segments.length >= 2 && !['all', 'list', 'export'].includes(segments[1]))
      || (segments[0] === 'api' && segments[1] === 'learning-memos' && segments.length >= 3 && !['all', 'list', 'export'].includes(segments[2]))
      || (segments[0] === 'api' && segments[1] === 'notes' && segments.length >= 3 && !['all', 'list', 'export'].includes(segments[2]));

    if (!isSingleItem) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'deny',
        reasonCode: 'zone_not_allowed',
        ruleIds: ['zone_rules'],
      };
    }
  }

  // 3-5. 알 수 없는 자원 ID 및 경로 거부
  if (!isNotesResource && !isNoticeResource && !isInstructorResource) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'route_not_allowed',
      ruleIds: ['zone_rules'],
    };
  }

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['device_registered', 'zone_rules'],
  };
}
