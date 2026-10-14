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
  // 운영 심판 요청 로그와 대조하지 못한 경우에는 실측으로 주장하지 않는다.
  // 이 점검은 제출 묶음에서 항상 미실행으로 남기고, 실측은 별도 증거 절차로 기록한다.
  return [{ attackId: 'anonymous_memo_list',
    expected: '로그인 토큰 없는 자료 목록 요청은 HTTP 401로 거부',
    observed: 'not_run' }];
}
