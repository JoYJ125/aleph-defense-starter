import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import learningMemosHandler, { createLearningMemosHandler } from '../api/learning-memos.js';
import learningMemoHandler from '../api/learning-memos/[id].js';

const baseline = JSON.parse(await readFile(new URL('../package/baseline-functions.json', import.meta.url)));
const config = JSON.parse(await readFile(new URL('../aleph.config.json', import.meta.url)));

function createResponse() {
  return {
    headers: new Map(),
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
  };
}

function createMemorySupabase(memos) {
  let generatedId = 0;
  return {
    from(table) {
      assert.equal(table, 'learning_memos');
      let operation = 'select';
      let selection = '*';
      let values;
      let ignoreDuplicates = false;
      const filters = [];
      const matchingRows = () => memos.filter(row => filters.every(([key, value, operator]) =>
        operator === 'in' ? value.includes(row[key]) : row[key] === value));
      const project = row => Object.fromEntries(selection.split(',').map(key => [key, row[key]]));

      async function execute(single) {
        let rows;
        if (operation === 'select') {
          rows = matchingRows();
        } else if (operation === 'insert') {
          const row = {
            ...values,
            id: values.id ?? `123e4567-e89b-42d3-a456-${String(++generatedId).padStart(12, '0')}`,
            created_at: '2026-10-07T00:00:00.000Z',
          };
          memos.push(row);
          rows = [row];
        } else if (operation === 'upsert') {
          rows = [];
          for (const value of values) {
            const existing = memos.find(row => row.id === value.id);
            if (!existing) {
              const row = { ...value, created_at: '2026-10-07T00:00:00.000Z' };
              memos.push(row);
              rows.push(row);
            } else if (!ignoreDuplicates) {
              Object.assign(existing, value);
              rows.push(existing);
            }
          }
        } else if (operation === 'update') {
          rows = matchingRows();
          for (const row of rows) Object.assign(row, values);
        } else {
          rows = matchingRows();
          for (const row of rows) memos.splice(memos.indexOf(row), 1);
        }

        const data = rows.map(project);
        return { data: single ? data[0] ?? null : data, error: null };
      }

      const builder = {
        select(columns = '*') { selection = columns; return builder; },
        eq(key, value) { filters.push([key, value]); return builder; },
        in(key, value) { filters.push([key, value, 'in']); return builder; },
        order() { return builder; },
        insert(row) { operation = 'insert'; values = row; return builder; },
        upsert(rows, options = {}) {
          operation = 'upsert';
          values = rows;
          ignoreDuplicates = options.ignoreDuplicates === true;
          return builder;
        },
        update(row) { operation = 'update'; values = row; return builder; },
        delete() { operation = 'delete'; return builder; },
        maybeSingle() { return execute(true); },
        single() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      return builder;
    },
  };
}

test('패키징 함수 기준표는 시작 틀의 실제 API와 일치한다', async () => {
  const root = new URL('../api/', import.meta.url);
  const [rootEntries, memoEntries] = await Promise.all([
    readdir(root, { withFileTypes: true }),
    readdir(new URL('../api/learning-memos/', import.meta.url)),
  ]);
  const actual = [
    ...rootEntries.filter(entry => entry.isFile() && /\.(?:m?js|ts)$/u.test(entry.name))
      .map(entry => join('api', entry.name).replaceAll('\\', '/')),
    ...memoEntries.filter(name => /\.(?:m?js|ts)$/u.test(name))
      .map(name => join('api', 'learning-memos', name).replaceAll('\\', '/')),
  ].sort();
  assert.equal(baseline.version, 1);
  assert.equal(baseline.starter, 'ChoiTimo/aleph-defense-starter');
  assert.deepEqual(baseline.functions, []);
  assert.deepEqual(baseline.allowedNew, ['api/ai.js', 'api/auth-config.js', 'api/learning-memos.js', 'api/learning-memos/[id].js', 'api/threat-intel.js']);
  assert.deepEqual(actual, [...baseline.functions, ...baseline.allowedNew].sort());
  assert.deepEqual(config.allowedRoutes, [
    'GET /api/learning-memos',
    'POST /api/learning-memos',
    'GET /api/learning-memos/:id',
    'PUT /api/learning-memos/:id',
    'DELETE /api/learning-memos/:id',
  ]);
});

test('learning memos function rejects missing or invalid student tokens without returning data', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalSecretKey = process.env.SUPABASE_SECRET_KEY;
  const testSecretKey = 'unit-test-key';
  let dataRequested = false;

  try {
    process.env.SUPABASE_URL = 'https://cvzbakfqmfomtyupjiej.supabase.co';
    process.env.SUPABASE_SECRET_KEY = testSecretKey;
    globalThis.fetch = async () => {
      dataRequested = true;
      throw new Error('unauthorized requests must not fetch memo data');
    };

    const missingTokenResponse = createResponse();
    await learningMemosHandler({ method: 'GET', headers: {} }, missingTokenResponse);
    assert.equal(missingTokenResponse.statusCode, 401);
    assert.deepEqual(missingTokenResponse.body, { error: 'UNAUTHORIZED' });

    const invalidTokenResponse = createResponse();
    await learningMemosHandler({
      method: 'GET',
      headers: { authorization: 'Bearer e30.e30.sig' },
      userId: 'attacker-controlled',
      role: 'authenticated',
    }, invalidTokenResponse);
    assert.equal(invalidTokenResponse.statusCode, 401);
    assert.deepEqual(invalidTokenResponse.body, { error: 'UNAUTHORIZED' });
    assert.equal(dataRequested, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalSecretKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalSecretKey;
  }
});

test('anonymous list requests are rejected before login verification or database access', async () => {
  let verifierCalls = 0;
  let databaseClientCalls = 0;
  const handler = createLearningMemosHandler({
    verifyAuthorization: async () => {
      verifierCalls += 1;
      return { kind: 'student', userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    },
    createSupabaseClient: () => {
      databaseClientCalls += 1;
      throw new Error('anonymous request must not reach the database');
    },
  });
  const response = createResponse();

  await handler({ method: 'GET', headers: {}, query: { owner_id: 'attacker-controlled' } }, response);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'UNAUTHORIZED' });
  assert.equal(verifierCalls, 0);
  assert.equal(databaseClientCalls, 0);
});

test('single memo GET, PUT, and DELETE reject requests without a verified bearer token', async () => {
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const response = createResponse();
    await learningMemoHandler({
      method,
      query: { id: '123e4567-e89b-42d3-a456-426614174000' },
      headers: {},
      userId: 'attacker-controlled',
      role: 'authenticated',
    }, response);
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: 'UNAUTHORIZED' });
  }
});

test('verified owners get separate editable starter memos and cannot access or transfer another owner records', async () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalSecretKey = process.env.SUPABASE_SECRET_KEY;
  const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const memoA = {
    id: '11111111-1111-4111-8111-111111111111', owner_id: userA,
    title: 'A memo', content: 'A private virtual memo', created_at: '2026-10-07T00:00:00.000Z',
  };
  const memoB = {
    id: '22222222-2222-4222-8222-222222222222', owner_id: userB,
    title: 'B memo', content: 'B private virtual memo', created_at: '2026-10-07T00:00:00.000Z',
  };
  const memos = [memoA, memoB];
  const identities = new Map([
    ['Bearer token-a', { kind: 'student', userId: userA }],
    ['Bearer token-b', { kind: 'student', userId: userB }],
  ]);
  const memorySupabase = createMemorySupabase(memos);
  const handler = createLearningMemosHandler({
    verifyAuthorization: async authorization => identities.get(authorization) ?? null,
    createSupabaseClient: () => memorySupabase,
  });

  async function call(method, { token, id, body, ownerIdQuery } = {}) {
    const request = { method, headers: { authorization: token }, body };
    if (id !== undefined) request.memoId = id;
    if (ownerIdQuery !== undefined) request.query = { owner_id: ownerIdQuery };
    const response = createResponse();
    await handler(request, response);
    return response;
  }

  try {
    process.env.SUPABASE_URL = 'https://cvzbakfqmfomtyupjiej.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'unit-test-key';

    const listA = await call('GET', { token: 'Bearer token-a' });
    const starterMemosA = listA.body.filter(memo => ['과제', '포트폴리오', '아침 리추얼', '훈련 행정 자료'].includes(memo.title));
    assert.equal(starterMemosA.length, 4);
    assert.deepEqual(listA.body.map(memo => memo.id).sort(), [memoA.id, ...starterMemosA.map(memo => memo.id)].sort());
    const starterTaskA = starterMemosA.find(memo => memo.title === '과제');
    assert.ok(starterTaskA);
    const ownReadA = await call('GET', { token: 'Bearer token-a', id: memoA.id });
    assert.deepEqual(ownReadA.body, { id: memoA.id, title: 'A memo', body: 'A private virtual memo' });

    const editStarterA = await call('PUT', {
      token: 'Bearer token-a', id: starterTaskA.id,
      body: { title: 'A의 수정 과제', body: 'A만 저장한 내용' },
    });
    assert.equal(editStarterA.statusCode, 200);
    assert.deepEqual(editStarterA.body, { id: starterTaskA.id, title: 'A의 수정 과제', body: 'A만 저장한 내용' });

    const reloadedA = await call('GET', { token: 'Bearer token-a' });
    const reloadedTaskA = reloadedA.body.find(memo => memo.id === starterTaskA.id);
    assert.deepEqual(reloadedTaskA, { id: starterTaskA.id, title: 'A의 수정 과제', body: 'A만 저장한 내용' });
    assert.deepEqual(reloadedA.body.map(memo => memo.id).sort(), listA.body.map(memo => memo.id).sort());

    const createA = await call('POST', {
      token: 'Bearer token-a',
      body: { title: 'A new memo', body: 'Created by A' },
    });
    assert.equal(createA.statusCode, 201);
    const createdA = memos.find(memo => memo.id === createA.body.id);
    assert.equal(createdA.owner_id, userA);

    const ownUpdateA = await call('PUT', {
      token: 'Bearer token-a', id: memoA.id,
      body: { title: 'A updated', body: 'Updated by A' },
    });
    assert.equal(ownUpdateA.statusCode, 200);
    assert.deepEqual(ownUpdateA.body, { id: memoA.id, title: 'A updated', body: 'Updated by A' });
    assert.equal(memoA.owner_id, userA);

    const spoofCreate = await call('POST', {
      token: 'Bearer token-a',
      body: { title: 'Spoof attempt', body: 'Should not be stored', owner_id: userB },
    });
    assert.equal(spoofCreate.statusCode, 403);
    assert.equal(memos.some(memo => memo.title === 'Spoof attempt'), false);

    const foreignRead = await call('GET', {
      token: 'Bearer token-a', id: memoB.id, ownerIdQuery: userB,
    });
    assert.equal(foreignRead.statusCode, 404);

    const foreignUpdate = await call('PUT', {
      token: 'Bearer token-a', id: memoB.id,
      body: { title: 'Changed by A', body: 'Should remain B-owned' },
    });
    assert.equal(foreignUpdate.statusCode, 404);
    assert.equal(memoB.title, 'B memo');

    const spoofUpdate = await call('PUT', {
      token: 'Bearer token-a', id: memoA.id,
      body: { title: 'Transfer attempt', body: 'Should remain A-owned', owner_id: userB },
    });
    assert.equal(spoofUpdate.statusCode, 403);
    assert.equal(memoA.owner_id, userA);

    const ownUpdateB = await call('PUT', {
      token: 'Bearer token-b', id: memoB.id,
      body: { title: 'B updated', body: 'Updated by B' },
    });
    assert.equal(ownUpdateB.statusCode, 200);
    assert.deepEqual(ownUpdateB.body, { id: memoB.id, title: 'B updated', body: 'Updated by B' });
    assert.equal(memoB.owner_id, userB);

    const createB = await call('POST', {
      token: 'Bearer token-b',
      body: { title: 'B new memo', body: 'Created by B' },
    });
    assert.equal(createB.statusCode, 201);
    const createdB = memos.find(memo => memo.id === createB.body.id);
    assert.equal(createdB.owner_id, userB);

    const foreignStarterRead = await call('GET', { token: 'Bearer token-b', id: starterTaskA.id });
    assert.equal(foreignStarterRead.statusCode, 404);
    const listB = await call('GET', { token: 'Bearer token-b' });
    const starterMemosB = listB.body.filter(memo => ['과제', '포트폴리오', '아침 리추얼', '훈련 행정 자료'].includes(memo.title));
    assert.equal(starterMemosB.length, 4);
    assert.equal(starterMemosB.some(memo => starterMemosA.some(aMemo => aMemo.id === memo.id)), false);
    assert.deepEqual(listB.body.map(memo => memo.id).sort(), [memoB.id, createdB.id, ...starterMemosB.map(memo => memo.id)].sort());
    assert.deepEqual(starterMemosB.find(memo => memo.title === '과제'), {
      id: starterMemosB.find(memo => memo.title === '과제').id,
      title: '과제',
      body: '실습용 가상 과제 기록',
    });

    const foreignDelete = await call('DELETE', { token: 'Bearer token-a', id: memoB.id });
    assert.equal(foreignDelete.statusCode, 404);
    assert.equal(memos.includes(memoB), true);

    const ownDelete = await call('DELETE', { token: 'Bearer token-a', id: createdA.id });
    assert.equal(ownDelete.statusCode, 204);
    const readDeleted = await call('GET', { token: 'Bearer token-a', id: createdA.id });
    assert.equal(readDeleted.statusCode, 404);

    const ownDeleteB = await call('DELETE', { token: 'Bearer token-b', id: createdB.id });
    assert.equal(ownDeleteB.statusCode, 204);
    const readDeletedB = await call('GET', { token: 'Bearer token-b', id: createdB.id });
    assert.equal(readDeletedB.statusCode, 404);
  } finally {
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
    await learningMemosHandler({ method: 'PATCH' }, methodResponse);
    assert.equal(methodResponse.statusCode, 405);
    assert.equal(methodResponse.headers.get('allow'), 'GET, POST');

    delete process.env.SUPABASE_SECRET_KEY;
    const configurationResponse = createResponse();
    await learningMemosHandler({
      method: 'GET', headers: { authorization: 'Bearer e30.e30.sig' },
    }, configurationResponse);
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
