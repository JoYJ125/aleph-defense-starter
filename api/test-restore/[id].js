import { createClient } from '@supabase/supabase-js';
import config from '../../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../../src/verify-login.mjs';
import { previewOneTestMemo, restoreOneTestMemo } from '../../src/restore-one-test-memo.mjs';

// Disabled on production by design; snapshots and trust anchors are server-only.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'GET, POST');
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (process.env.VERCEL_ENV !== 'preview' || process.env.TEST_MEMO_RESTORE_ENABLED !== 'true')
    return res.status(403).json({ error: 'TEST_RESTORE_DISABLED' });
  const owner = process.env.TEST_ACCOUNT_B_USER_ID;
  const id = req.query?.id;
  if (typeof owner !== 'string' || typeof id !== 'string'
      || !/^[0-9a-f-]{36}$/i.test(owner) || !/^[0-9a-f-]{36}$/i.test(id))
    return res.status(400).json({ error: 'INVALID_TEST_TARGET' });
  const auth = req.headers?.authorization;
  if (typeof auth !== 'string') return res.status(401).json({ error: 'UNAUTHORIZED' });
  const secret = process.env.SUPABASE_SECRET_KEY;
  const url = process.env.SUPABASE_URL;
  const snapshotText = process.env.PRIVATE_TEST_MEMO_SNAPSHOT_JSON;
  const publicKey = process.env.TEST_MEMO_SNAPSHOT_PUBLIC_KEY_PEM;
  const incidentAt = process.env.TEST_MEMO_INCIDENT_AT;
  if (!secret || !url || !snapshotText || !publicKey || !incidentAt)
    return res.status(503).json({ error: 'TEST_RESTORE_NOT_CONFIGURED' });
  try {
    if (new URL(url).origin !== new URL(config.identityProvider.issuer).origin)
      return res.status(503).json({ error: 'TEST_RESTORE_NOT_CONFIGURED' });
    const identity = await createLoginVerifier({ config, supabaseSecretKey: secret })(auth);
    if (identity?.kind !== 'student' || identity.userId !== owner)
      return res.status(403).json({ error: 'TEST_ACCOUNT_B_ONLY' });
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some(key => key !== 'confirmationToken'))
      return res.status(400).json({ error: 'BODY_NOT_ALLOWED' });
    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const args = { db, snapshot: JSON.parse(snapshotText),
      trustedPublicKey: publicKey, incidentAt, expectedOwner: owner, requestedId: id };
    if (req.method === 'GET') return res.status(200).json(await previewOneTestMemo(args));
    if (typeof body.confirmationToken !== 'string')
      return res.status(428).json({ error: 'RESTORE_PREVIEW_REQUIRED' });
    const result = await restoreOneTestMemo({ ...args, confirmationToken: body.confirmationToken });
    return res.status(200).json(result);
  } catch (error) {
    const invalid = /SNAPSHOT|MEMO_NOT_FOUND|RESTORE_VERIFICATION|RESTORE_CONFIRMATION/.test(error.message);
    return res.status(invalid ? 409 : 502).json({ error: invalid ? 'RESTORE_ABORTED' : 'RESTORE_UNAVAILABLE' });
  }
}
