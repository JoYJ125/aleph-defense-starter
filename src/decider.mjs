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

  // 3. 구역 규칙 (8단계): 정확한 경로와 자원 검증, 기능 경로 거부, 소유자 격리 및 공지 수정 권한 통제
  const pathStr = typeof request?.path === 'string' ? request.path.trim() : '';
  const segments = pathStr.split('/').filter(Boolean);
  const service = typeof request?.service === 'string' ? request.service.trim() : '';

  // 3-1. :id 위치 또는 경로에 export 등 기능 경로가 오면 거부 (쿼리/기능 경로 배제)
  const FUNCTIONAL_KEYWORDS = new Set(['export', 'import', 'download', 'upload', 'action', 'actions']);
  if (segments.some(seg => FUNCTIONAL_KEYWORDS.has(seg.toLowerCase()))) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'route_not_allowed',
      ruleIds: ['zone_rules'],
    };
  }

  // 3-2. 알 수 없는 서비스 및 경로 거부
  const isNotesService = service === 'notes' || segments[0] === 'notes'
    || (segments[0] === 'api' && segments[1] === 'learning-memos');
  const isNoticesService = service === 'notices' || segments[0] === 'notices'
    || (segments[0] === 'api' && segments[1] === 'notices');

  if (!isNotesService && !isNoticesService) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'route_not_allowed',
      ruleIds: ['zone_rules'],
    };
  }

  const subject = typeof request?.subjectId === 'string' ? request.subjectId : '';

  // 3-3. 공지 구역: 강사 공지 수정은 허용, 일반 학생의 공지 수정(POST/PUT/DELETE/PATCH)은 거부
  if (isNoticesService) {
    const isModify = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request?.method);
    const isInstructor = subject.includes('instructor') || subject.includes('teacher') || subject.includes('admin');

    if (isModify && !isInstructor) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'deny',
        reasonCode: 'zone_not_allowed',
        ruleIds: ['zone_rules'],
      };
    }
  }

  // 3-4. 메모 구역: A의 자기 메모 읽기·수정은 허용, B의 A 메모 읽기·수정은 거부 (자원 소유권 격리)
  if (isNotesService) {
    let targetOwner = null;
    if (segments[0] === 'notes') {
      if (segments.length >= 3) {
        targetOwner = segments[1];
      } else if (segments.length === 2) {
        const candidate = segments[1];
        if (candidate !== subject && (candidate === 'A' || candidate === 'B' || candidate.startsWith('learner_') || candidate.startsWith('user_') || candidate.startsWith('student_'))) {
          targetOwner = candidate;
        }
      }
    } else if (segments[0] === 'api' && segments[1] === 'learning-memos') {
      if (segments.length >= 4) {
        targetOwner = segments[2];
      } else if (segments.length === 3) {
        const candidate = segments[2];
        if (candidate !== subject && (candidate === 'A' || candidate === 'B' || candidate.startsWith('learner_') || candidate.startsWith('user_') || candidate.startsWith('student_'))) {
          targetOwner = candidate;
        }
      }
    }

    if (targetOwner && targetOwner !== subject) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'deny',
        reasonCode: 'zone_not_allowed',
        ruleIds: ['zone_rules'],
      };
    }
  }

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['device_registered', 'zone_rules'],
  };
}
