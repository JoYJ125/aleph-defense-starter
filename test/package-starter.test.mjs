import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import learningMemosHandler from '../api/learning-memos.js';

const baseline = JSON.parse(await readFile(new URL('../package/baseline-functions.json', import.meta.url)));

function createResponse() {
  return {
    headers: new Map(),
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('패키징 함수 기준표는 시작 틀의 실제 API와 일치한다', async () => {
  const actual = (await readdir(new URL('../api/', import.meta.url)))
    .filter(name => /\.(?:m?js|ts)$/u.test(name))
    .map(name => join('api', name).replaceAll('\\', '/')).sort();
  assert.equal(baseline.version, 1);
  assert.equal(baseline.starter, 'ChoiTimo/aleph-defense-starter');
  assert.deepEqual(baseline.functions, []);
  assert.deepEqual(baseline.allowedNew, ['api/ai.js', 'api/learning-memos.js', 'api/threat-intel.js']);
  assert.deepEqual(actual, [...baseline.functions, ...baseline.allowedNew].sort());
});

test('learning memos function uses the server key and returns only four memo rows', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalSecretKey = process.env.SUPABASE_SECRET_KEY;
  const testSecretKey = 'unit-test-key';
  const memos = Array.from({ length: 4 }, (_, index) => ({
    title: `Memo ${index + 1}`,
    content: `Sample ${index + 1}`,
  }));
  let requestUrl;
  let requestHeaders;

  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = testSecretKey;
    globalThis.fetch = async (url, options) => {
      requestUrl = new URL(String(url));
      requestHeaders = new Headers(options.headers);
      return new Response(JSON.stringify(memos), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const response = createResponse();
    await learningMemosHandler({ method: 'GET' }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(requestUrl.pathname, '/rest/v1/learning_memos');
    assert.equal(requestUrl.searchParams.get('limit'), '4');
    assert.equal(requestHeaders.get('apikey'), testSecretKey);
    assert.deepEqual(response.body, memos);
    assert.equal(JSON.stringify(response.body).includes(testSecretKey), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalSecretKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalSecretKey;
  }
});

test('learning memos function rejects unsupported methods and missing configuration', async () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalSecretKey = process.env.SUPABASE_SECRET_KEY;
  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'unit-test-key';
    const methodResponse = createResponse();
    await learningMemosHandler({ method: 'POST' }, methodResponse);
    assert.equal(methodResponse.statusCode, 405);
    assert.equal(methodResponse.headers.get('allow'), 'GET');

    delete process.env.SUPABASE_SECRET_KEY;
    const configurationResponse = createResponse();
    await learningMemosHandler({ method: 'GET' }, configurationResponse);
    assert.equal(configurationResponse.statusCode, 500);
    assert.deepEqual(configurationResponse.body, { error: 'SERVER_CONFIGURATION_ERROR' });
  } finally {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalSecretKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalSecretKey;
  }
});

test('미구현 서버 뼈대는 성공이나 로그인 통과로 가장하지 않는다', async () => {
  for (const name of ['ai', 'threat-intel']) {
    const { default: handler } = await import(`../api/${name}.js`);
    const headers = new Map();
    let status;
    let body;
    handler({}, {
      setHeader: (key, value) => headers.set(key.toLowerCase(), value),
      status: value => { status = value; return { json: value => { body = value; } }; },
    });
    assert.equal(status, 501);
    assert.equal(headers.get('cache-control'), 'no-store');
    assert.match(body.error, /NOT_IMPLEMENTED$/u);
  }
});

test('P7 시작 틀 안내는 실제 빌드 조건과 새 배포 시험에 맞는다', async () => {
  const readme = await readFile(new URL('../package/README.md', import.meta.url), 'utf8');
  const selfCheck = await readFile(new URL('../package/SELF-CHECK.md', import.meta.url), 'utf8');
  assert.match(readme, /새 Vercel 프로젝트/u);
  assert.match(readme, /Vercel이 제공하는 저장소·커밋·배포 URL 정보/u);
  assert.doesNotMatch(readme, /npm start/u);
  assert.match(selfCheck, /P7-3\.png/u);
});
