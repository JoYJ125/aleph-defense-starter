import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { previewPolicyRestore } from '../scripts/policy-restore-preview.mjs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const trustedPublicKey = publicKey.export({ type: 'spki', format: 'pem' });
const payload = { version: 'safe-v1', verifiedAt: '2026-10-01T00:00:00Z',
  policy: { access: { allow: false }, revision: 3 } };
const snapshot = { payload, signature: sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64') };
const input = { snapshot, trustedPublicKey, incidentAt: '2026-10-02T00:00:00Z',
  currentPolicy: { access: { allow: true }, revision: 3 } };

test('verified pre-incident snapshot shows only changes and target version', () => {
  const result = previewPolicyRestore(input);
  assert.equal(result.mode, 'preview_only');
  assert.equal(result.restoreVersion, 'safe-v1');
  assert.deepEqual(result.differences, [{ path: 'access.allow', current: true,
    restoreTo: false, change: 'replace' }]);
});
test('missing snapshot aborts', () =>
  assert.throws(() => previewPolicyRestore({ ...input, snapshot: null }), /SAFE_SNAPSHOT_MISSING/));
test('tampered snapshot aborts', () =>
  assert.throws(() => previewPolicyRestore({ ...input, snapshot: { ...snapshot,
    payload: { ...payload, version: 'tampered' } } }), /SNAPSHOT_SIGNATURE_INVALID/));
test('post-incident snapshot aborts', () =>
  assert.throws(() => previewPolicyRestore({ ...input, incidentAt: '2026-09-30T00:00:00Z' }), /SNAPSHOT_NOT_BEFORE_INCIDENT/));
test('missing trust anchor aborts', () =>
  assert.throws(() => previewPolicyRestore({ ...input, trustedPublicKey: null }), /TRUST_ANCHOR_MISSING/));
