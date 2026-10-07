import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { deploymentIdentity, isQueryFreeHttpsApiUrl } from '../scripts/deployment-identity.mjs';

const config = JSON.parse(await readFile(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const env = {
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'Student-A',
  VERCEL_GIT_REPO_SLUG: 'aleph-defense',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_URL: 'student-defense-123.vercel.app',
};

test('deployment identity emits configured allowed routes and rejects a missing or empty list', () => {
  assert.ok(config.allowedRoutes.length > 0);
  assert.deepEqual(deploymentIdentity(env, config).allowedRoutes, config.allowedRoutes);
  assert.throws(() => deploymentIdentity(env, { ...config, allowedRoutes: [] }));
  assert.throws(() => deploymentIdentity(env, { ...config, allowedRoutes: undefined }));
});

test('stage 5 requires a query-free HTTPS original API endpoint', () => {
  assert.equal(config.step, 5);
  assert.equal(isQueryFreeHttpsApiUrl(config.originalApiUrl), true);
  assert.equal(isQueryFreeHttpsApiUrl('http://example.supabase.co/rest/v1/learning_memos'), false);
  assert.equal(isQueryFreeHttpsApiUrl('https://example.supabase.co/rest/v1/learning_memos?select=*'), false);
  assert.equal(isQueryFreeHttpsApiUrl('https://example.supabase.co/rest/v1/learning_memos?'), false);
  assert.equal(isQueryFreeHttpsApiUrl('https://user:password@example.supabase.co/rest/v1/learning_memos'), false);
  assert.throws(() => deploymentIdentity(env, { ...config, originalApiUrl: undefined }));
});

test('Vercel first-page response configuration includes a security header', async () => {
  const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const headers = vercel.headers.flatMap(rule => rule.headers ?? []);
  assert.ok(headers.some(header =>
    (header.key.toLowerCase() === 'x-content-type-options' && header.value.toLowerCase() === 'nosniff')
    || header.key.toLowerCase() === 'content-security-policy'));
});

test('browser page contains no embedded Supabase publishable or JWT anon key', async () => {
  const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /sb_publishable_[A-Za-z0-9_-]+/u);
  assert.doesNotMatch(page, /(?:eyJ[A-Za-z0-9_-]{10,}\.){2}[A-Za-z0-9_-]+/u);
  assert.match(page, /fetch\('\/api\/auth-config'/u);
});

test('browser hides memo data without a session and ignores list responses after logout', async () => {
  const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(page, /function hasSessionCredentials\(session\)/u);
  assert.match(page, /if \(!hasSessionCredentials\(session\)\) \{\s*showMemoMessage\('로그인 후 자료를 확인할 수 있습니다\.'\);\s*return;/u);
  assert.match(page, /const isSignedIn = hasSessionCredentials\(session\)/u);
  assert.match(page, /requestId === memoRequestId && hasSessionCredentials\(currentSession\)\) renderMemos\(notes\)/u);
});
