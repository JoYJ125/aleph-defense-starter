import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { planTestPolicyRestore, applyTestPolicyRestore } from '../scripts/restore-test-policy.mjs';
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const payload = { version: 'safe-preincident-v1', verifiedAt: '2026-09-01T00:00:00Z',
  policy: { ownership: { enforceOwner: true }, otherService: { allow: true }, audit: { history: ['original'] } } };
const snapshot = { payload, signature: sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64') };
const currentPolicy = { ownership: { enforceOwner: false }, otherService: { allow: false },
  audit: { history: ['original', 'incident-record'] } };
const args = { snapshot, currentPolicy,
  trustedPublicKey: publicKey.export({ type: 'spki', format: 'pem' }),
  incidentAt: '2026-09-02T00:00:00Z' };
function authorize(policy, requester, owner) { return !policy.ownership.enforceOwner || requester === owner; }
test('preview shows version and only ownership scope', () => {
  const plan = planTestPolicyRestore(args);
  assert.equal(plan.restoreVersion, 'safe-preincident-v1');
  assert.deepEqual(plan.changeScope, ['ownership']);
  assert.deepEqual(plan.differences.map(d => d.path), ['ownership.enforceOwner']);
});
test('B accessing A denied after restore; A remains allowed; other rules and audit preserved', () => {
  const token = planTestPolicyRestore(args).confirmationToken;
  const result = applyTestPolicyRestore(args, token);
  assert.equal(authorize(result.policy, 'B', 'A'), false);
  assert.equal(authorize(result.policy, 'A', 'A'), true);
  assert.deepEqual(result.policy.otherService, currentPolicy.otherService);
  assert.deepEqual(result.policy.audit, currentPolicy.audit);
  assert.equal(currentPolicy.ownership.enforceOwner, false);
});
test('missing confirmation aborts', () => assert.throws(() => applyTestPolicyRestore(args, ''), /CONFIRMATION/));
test('tampered snapshot aborts', () => assert.throws(() => planTestPolicyRestore({ ...args,
  snapshot: { ...snapshot, payload: { ...payload, version: 'changed' } } }), /SIGNATURE/));
test('missing snapshot aborts', () => assert.throws(() => planTestPolicyRestore({ ...args, snapshot: null }), /MISSING/));
test('changed test policy invalidates confirmation', () => {
  const token = planTestPolicyRestore(args).confirmationToken;
  assert.throws(() => applyTestPolicyRestore({ ...args,
    currentPolicy: { ...currentPolicy, ownership: { enforceOwner: true } } }, token), /CONFIRMATION/);
});
