// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (config.step !== 1) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  const response = await fetch(new URL('/api/learning-memos', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store',
  });
  let visible = false;
  let noteCount = 0;
  if (response.ok) {
    try {
      const notes = await response.json();
      visible = Array.isArray(notes) && notes.length === 4;
      if (visible) noteCount = notes.length;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '공개 Vercel 함수에서 가상 메모 네 건을 확인',
    observed: visible ? `비로그인 요청에서 Vercel 함수가 가상 메모 ${noteCount}건 반환` : `비로그인 요청에서 Vercel 함수 메모가 확인되지 않음 (HTTP ${response.status})` }];
}
