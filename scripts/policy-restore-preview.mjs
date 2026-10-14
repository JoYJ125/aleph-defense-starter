import { readFileSync } from 'node:fs';
import { createPublicKey, verify } from 'node:crypto';

// Read-only preview. Trust anchor must be supplied independently of the snapshot.
export function previewPolicyRestore({ snapshot, currentPolicy, trustedPublicKey, incidentAt }) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
    throw new Error('SAFE_SNAPSHOT_MISSING');
  const { payload, signature } = snapshot;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || typeof payload.version !== 'string' || !payload.version.trim()
      || typeof payload.verifiedAt !== 'string'
      || !Number.isFinite(Date.parse(payload.verifiedAt))
      || !payload.policy || typeof payload.policy !== 'object' || Array.isArray(payload.policy)
      || typeof signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature))
    throw new Error('SAFE_SNAPSHOT_INVALID');
  const incidentTime = Date.parse(incidentAt);
  if (!Number.isFinite(incidentTime) || Date.parse(payload.verifiedAt) >= incidentTime)
    throw new Error('SNAPSHOT_NOT_BEFORE_INCIDENT');
  if (!trustedPublicKey) throw new Error('TRUST_ANCHOR_MISSING');
  let valid = false;
  try {
    const key = createPublicKey(trustedPublicKey);
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('invalid key');
    valid = verify(null, Buffer.from(JSON.stringify(payload), 'utf8'), key,
      Buffer.from(signature, 'base64'));
  } catch { valid = false; }
  if (!valid) throw new Error('SNAPSHOT_SIGNATURE_INVALID');
  if (!currentPolicy || typeof currentPolicy !== 'object' || Array.isArray(currentPolicy))
    throw new Error('CURRENT_POLICY_INVALID');

  const differences = [];
  const walk = (safe, current, path) => {
    if (safe && current && typeof safe === 'object' && typeof current === 'object'
        && !Array.isArray(safe) && !Array.isArray(current)) {
      for (const key of [...new Set([...Object.keys(safe), ...Object.keys(current)])].sort()) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype')
          throw new Error('UNSAFE_POLICY_KEY');
        walk(safe[key], current[key], [...path, key]);
      }
    } else if (JSON.stringify(safe) !== JSON.stringify(current)) {
      differences.push({ path: path.join('.'), current: current === undefined ? null : current,
        restoreTo: safe === undefined ? null : safe,
        change: safe === undefined ? 'remove' : current === undefined ? 'add' : 'replace' });
    }
  };
  walk(payload.policy, currentPolicy, []);
  return { mode: 'preview_only', restoreVersion: payload.version,
    verifiedAt: payload.verifiedAt, changeCount: differences.length, differences };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    if (process.argv.length !== 6) throw new Error('USAGE: node scripts/policy-restore-preview.mjs <signed-snapshot.json> <current-test-policy.json> <trusted-public-key.pem> <incident-ISO-time>');
    const [, , snapshotFile, currentFile, keyFile, incidentAt] = process.argv;
    const result = previewPolicyRestore({
      snapshot: JSON.parse(readFileSync(snapshotFile, 'utf8')),
      currentPolicy: JSON.parse(readFileSync(currentFile, 'utf8')),
      trustedPublicKey: readFileSync(keyFile, 'utf8'), incidentAt,
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stderr.write('PREVIEW_ABORTED: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
