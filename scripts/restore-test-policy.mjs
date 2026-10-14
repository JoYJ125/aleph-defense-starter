import { readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, basename } from 'node:path';
import { previewPolicyRestore } from './policy-restore-preview.mjs';

// Only the test policy's ownership rule may be restored; never modify production.
export function planTestPolicyRestore(args) {
  const { currentPolicy } = args;
  if (!currentPolicy || typeof currentPolicy !== 'object' || Array.isArray(currentPolicy))
    throw new Error('CURRENT_POLICY_INVALID');
  const preview = previewPolicyRestore(args);
  if (!Object.hasOwn(args.snapshot.payload.policy, 'ownership'))
    throw new Error('SAFE_OWNERSHIP_POLICY_MISSING');
  if (!currentPolicy.ownership || !args.snapshot.payload.policy.ownership
      || typeof currentPolicy.ownership !== 'object'
      || typeof args.snapshot.payload.policy.ownership !== 'object'
      || Array.isArray(currentPolicy.ownership)
      || Array.isArray(args.snapshot.payload.policy.ownership))
    throw new Error('OWNERSHIP_POLICY_INVALID');
  const changes = preview.differences.filter(d => d.path === 'ownership' || d.path.startsWith('ownership.'));
  const restored = structuredClone(currentPolicy);
  restored.ownership = structuredClone(args.snapshot.payload.policy.ownership);
  const changeScope = ['ownership'];
  const token = createHash('sha256').update(JSON.stringify({
    version: preview.restoreVersion, currentPolicy, ownership: restored.ownership,
    changeScope,
  })).digest('hex');
  return { mode: 'confirmation_required', restoreVersion: preview.restoreVersion,
    verifiedAt: preview.verifiedAt, changeScope, changeCount: changes.length,
    differences: changes, confirmationToken: token, restored };
}

export function applyTestPolicyRestore(args, confirmationToken) {
  const plan = planTestPolicyRestore(args);
  if (!confirmationToken || confirmationToken !== plan.confirmationToken)
    throw new Error('RESTORE_CONFIRMATION_REQUIRED');
  return { mode: 'test_policy_restored', restoreVersion: plan.restoreVersion,
    changeScope: plan.changeScope, changeCount: plan.changeCount,
    policy: plan.restored };
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  try {
    const argv = process.argv.slice(2);
    if (argv.length !== 5 && argv.length !== 7)
      throw new Error('USAGE: node scripts/restore-test-policy.mjs <signed-snapshot.json> <current-test-policy.json> <trusted-public-key.pem> <incident-ISO-time> <preview|apply> [--confirm <token>]');
    const [snapshotFile, testFile, keyFile, incidentAt, mode, flag, confirmationToken] = argv;
    if (!['preview', 'apply'].includes(mode) || (mode === 'apply' && (flag !== '--confirm' || !confirmationToken))
        || (mode === 'preview' && argv.length !== 5))
      throw new Error('RESTORE_CONFIRMATION_REQUIRED');
    const target = resolve(testFile);
    if (!basename(target).endsWith('.test-policy.json'))
      throw new Error('TEST_POLICY_FILE_REQUIRED');
    const args = { snapshot: JSON.parse(readFileSync(snapshotFile, 'utf8')),
      currentPolicy: JSON.parse(readFileSync(target, 'utf8')),
      trustedPublicKey: readFileSync(keyFile, 'utf8'), incidentAt };
    const plan = planTestPolicyRestore(args);
    if (mode === 'preview') {
      const { restored, ...safePlan } = plan;
      process.stdout.write(JSON.stringify(safePlan, null, 2) + '\n');
    } else {
      const result = applyTestPolicyRestore(args, confirmationToken);
      const temp = resolve(dirname(target), '.' + basename(target) + '.restore-' + process.pid);
      let fd;
      try {
        fd = openSync(temp, 'wx', 0o600);
        writeFileSync(fd, JSON.stringify(result.policy, null, 2) + '\n');
        closeSync(fd); fd = undefined;
        renameSync(temp, target);
      } finally {
        if (fd !== undefined) closeSync(fd);
        try { unlinkSync(temp); } catch {}
      }
      process.stdout.write(JSON.stringify({ mode: result.mode,
        restoreVersion: result.restoreVersion, changeScope: result.changeScope,
        changeCount: result.changeCount }) + '\n');
    }
  } catch (error) {
    process.stderr.write('RESTORE_ABORTED: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
