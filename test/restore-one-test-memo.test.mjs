import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { verifyPrivateMemoSnapshot, restoreOneTestMemo } from '../src/restore-one-test-memo.mjs';
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const id = '11111111-1111-4111-8111-111111111111';
const owner = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const content = '시험 계정 B의 비공개 가상 메모';
const hash = createHash('sha256').update(content).digest('hex');
const payload = { version: 'pre-incident-b-v1', verifiedAt: '2026-09-01T00:00:00Z',
  id, owner_id: owner, title: 'B 가상 메모', content, contentSha256: hash };
const snapshot = { payload, signature: sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64') };
const args = { snapshot, trustedPublicKey: publicKey.export({ format: 'pem', type: 'spki' }),
  incidentAt: '2026-09-02T00:00:00Z', expectedOwner: owner, requestedId: id };
test('B single memo restore matches ID, owner, content hash; other rows/audit untouched', async () => {
  const rows = [{ id, owner_id: owner, title: 'changed', content: 'tampered' },
    { id: '22222222-2222-4222-8222-222222222222', owner_id: owner, title: 'other', content: 'keep' }];
  const audit = ['existing-audit'];
  const db = { from(table) {
    assert.equal(table, 'learning_memos');
    const filters = [];
    let update = null;
    const query = { select() { return query; }, eq(k,v) { filters.push([k,v]); return query; },
      update(value) { update = value; return query; },
      async maybeSingle() {
        const row = rows.find(r => filters.every(([k,v]) => r[k] === v));
        if (update && row) Object.assign(row, update);
        return { data: row ? { ...row } : null, error: null };
      } };
    return query;
  } };
  const result = await restoreOneTestMemo({ db, ...args });
  assert.equal(result.id, id); assert.equal(result.owner_id, owner);
  assert.equal(result.contentSha256, hash);
  assert.equal(rows[1].content, 'keep');
  assert.deepEqual(audit, ['existing-audit']);
});
test('wrong owner is rejected', () => assert.throws(() => verifyPrivateMemoSnapshot({
  ...args, expectedOwner: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }), /SNAPSHOT_INVALID/));
test('wrong ID is rejected', () => assert.throws(() => verifyPrivateMemoSnapshot({
  ...args, requestedId: '22222222-2222-4222-8222-222222222222' }), /SNAPSHOT_INVALID/));
test('tampered content rejected', () => assert.throws(() => verifyPrivateMemoSnapshot({
  ...args, snapshot: { ...snapshot, payload: { ...payload, content: 'modified' } } }), /VERIFICATION_FAILED/));
test('missing snapshot rejected', () => assert.throws(() => verifyPrivateMemoSnapshot({
  ...args, snapshot: null }), /UNAVAILABLE/));
