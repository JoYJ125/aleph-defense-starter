import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';
import { runAttackChecks } from '../src/attack-check.mjs';
import authConfigHandler from '../api/auth-config.js';

const config = {
  step: 5,
  judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
  sampleMarker: 'SAMPLE_NOTE_1',
  publicAppUrl: 'https://student-defense.vercel.app',
  originalApiUrl: 'https://cvzbakfqmfomtyupjiej.supabase.co/rest/v1/learning_memos',
  allowedRoutes: [
    'GET /api/learning-memos',
    'POST /api/learning-memos',
    'GET /api/learning-memos/:id',
    'PUT /api/learning-memos/:id',
    'DELETE /api/learning-memos/:id',
  ],
};
const env = {
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'Student-A',
  VERCEL_GIT_REPO_SLUG: 'aleph-defense',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_URL: 'student-defense-123.vercel.app',
};

test('build identity uses Vercel Git and deployment metadata', () => {
  assert.deepEqual(deploymentIdentity(env, config), {
    schema: 'aleph.defense.deployment.v1',
    step: 5,
    repoUrl: 'https://github.com/student-a/aleph-defense',
    commit: 'a'.repeat(40),
    publicAppUrl: 'https://student-defense-123.vercel.app',
    judgeIssuer: config.judgeIssuer,
    allowedRoutes: config.allowedRoutes,
  });
  assert.throws(() => deploymentIdentity({ ...env, VERCEL_GIT_PROVIDER: undefined }, config));
  assert.throws(() => deploymentIdentity({ ...env, VERCEL_GIT_COMMIT_SHA: 'short' }, config));
});

test('stage 5 self-check records anonymous memo access without reading returned notes', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let options;
  try {
    globalThis.fetch = async (url, init) => {
      requestUrl = String(url);
      options = init;
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    };
    const [result] = await runAttackChecks(config);
    const request = new URL(requestUrl);
    assert.equal(request.origin, 'https://student-defense.vercel.app');
    assert.equal(request.pathname, '/api/learning-memos');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers, undefined);
    assert.match(result.expected, /HTTP 401/u);
    assert.match(result.observed, /HTTP 401/u);
    globalThis.fetch = async () => new Response('<html>not the data</html>', { status: 200 });
    const [failed] = await runAttackChecks(config);
    assert.match(failed.observed, /확인되지 않음/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('auth config returns only the public Supabase settings', () => {
  const previous = {
    url: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
    secretKey: process.env.SUPABASE_SECRET_KEY,
  };
  Object.assign(process.env, {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    SUPABASE_ANON_KEY: 'legacy_anon_example',
    SUPABASE_SECRET_KEY: 'server_secret_example',
  });
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    authConfigHandler({ method: 'GET' }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(response.body.url, 'https://cvzbakfqmfomtyupjiej.supabase.co');
    assert.match(response.body.publishableKey, /^sb_publishable_/u);
    assert.equal(JSON.stringify(response.body).includes('server_secret_example'), false);
  } finally {
    for (const [name, value] of [
      ['SUPABASE_URL', previous.url],
      ['SUPABASE_PUBLISHABLE_KEY', previous.publishableKey],
      ['SUPABASE_ANON_KEY', previous.anonKey],
      ['SUPABASE_SECRET_KEY', previous.secretKey],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
