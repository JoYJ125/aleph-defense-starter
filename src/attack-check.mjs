// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (!Number.isInteger(config.step) || config.step < 3) {
    throw new Error('3단계 자료 API의 로그인 거부 점검을 실행하려면 step을 확인해 주세요.');
  }
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  const response = await fetch(new URL('/api/learning-memos', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store',
  });
  let blocked = false;
  if (response.status === 401) {
    try {
      const body = await response.json();
      blocked = body?.error === 'UNAUTHORIZED' && Object.keys(body).length === 1;
    } catch {
      // A non-JSON response is not proof that the request was denied safely.
    }
  } else {
    await response.body?.cancel();
  }
  return [{ attackId: 'anonymous_memo_list', expected: '로그인 토큰 없는 자료 목록 요청은 HTTP 401로 거부',
    observed: blocked ? '비로그인 요청이 HTTP 401로 거부되어 자료가 반환되지 않음' : `비로그인 자료 요청 차단이 확인되지 않음 (HTTP ${response.status})` }];
}
