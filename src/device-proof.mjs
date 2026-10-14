import { createHash } from 'node:crypto';
export async function verifyDeviceProof(db, userId, proof) {
  if (typeof proof !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(proof)) return false;
  const digest = createHash('sha256').update(proof).digest('hex');
  const { data, error } = await db.from('device_sessions').select('token_hash,credential_id').eq('token_hash', digest).eq('user_id', userId).gt('expires_at', new Date().toISOString()).maybeSingle();
  return !error && !!data;
}
