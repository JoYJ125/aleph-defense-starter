import { randomBytes, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const origin = new URL(config.publicAppUrl).origin;
const rpID = new URL(origin).hostname;
const rpName = 'BYTE BACK 내 자료실';
const base64url = bytes => Buffer.from(bytes).toString('base64url');
const decode = text => new Uint8Array(Buffer.from(text, 'base64url'));
const reply = (res, code, body) => res.status(code).json(body);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return reply(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return reply(res, 503, { error: 'DEVICE_SERVICE_UNAVAILABLE' });
  let identity;
  try {
    identity = await createLoginVerifier({ config, supabaseSecretKey: process.env.SUPABASE_SECRET_KEY })(req.headers?.authorization);
  } catch { return reply(res, 401, { error: 'UNAUTHORIZED' }); }
  if (identity?.kind !== 'student' || !/^[a-f0-9-]{36}$/i.test(identity.userId)) return reply(res, 401, { error: 'UNAUTHORIZED' });
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const uid = identity.userId;
  try {
    if (req.method === 'GET') return reply(res, 200, { approved: false, requiresSignature: true });
    const action = req.body?.action;
    if (typeof action !== 'string' || !['register-start','register-finish','auth-start','auth-finish'].includes(action)) return reply(res, 400, { error: 'INVALID_ACTION' });
    const { data: credentials, error: credError } = await db.from('device_credentials').select('*').eq('user_id', uid);
    if (credError) throw credError;
    if (action === 'auth-start' && credentials.length === 0) return reply(res, 403, { error: 'DEVICE_NOT_REGISTERED' });
    if (action === 'register-start' || action === 'auth-start') {
      const options = action === 'register-start'
        ? await generateRegistrationOptions({
            rpName, rpID, userID: decode(base64url(Buffer.from(uid))), userName: uid,
            attestationType: 'none', authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
            excludeCredentials: credentials.map(c => ({ id: c.id, transports: c.transports })),
          })
        : await generateAuthenticationOptions({
            rpID, userVerification: 'required',
            allowCredentials: credentials.map(c => ({ id: c.id, transports: c.transports })),
          });
      const { error } = await db.from('device_challenges').upsert({
        user_id: uid, challenge: options.challenge,
        kind: action === 'register-start' ? 'register' : 'authenticate',
        expires_at: new Date(Date.now() + 120000).toISOString(),
      });
      if (error) throw error;
      return reply(res, 200, { options });
    }
    const kind = action === 'register-finish' ? 'register' : 'authenticate';
    const { data: challenge, error: challengeError } = await db.from('device_challenges').delete().eq('user_id', uid).eq('kind', kind).gt('expires_at', new Date().toISOString()).select().maybeSingle();
    if (challengeError || !challenge) return reply(res, 403, { error: 'CHALLENGE_EXPIRED' });
    const response = req.body?.response;
    if (!response || typeof response !== 'object') return reply(res, 400, { error: 'INVALID_ASSERTION' });
    if (kind === 'register') {
      const verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
      if (!verification.verified || !verification.registrationInfo) return reply(res, 403, { error: 'REGISTRATION_REJECTED' });
      const { credential } = verification.registrationInfo;
      const { error } = await db.from('device_credentials').insert({
        id: credential.id, user_id: uid, public_key: base64url(credential.publicKey),
        counter: credential.counter, transports: response.response?.transports ?? [],
      });
      if (error) return reply(res, 409, { error: 'REGISTRATION_CONFLICT' });
      return reply(res, 200, { registered: true, approved: false, next: 'auth-start' });
    }
    const registered = credentials.find(c => c.id === response.id);
    if (!registered) return reply(res, 403, { error: 'DEVICE_NOT_REGISTERED' });
    const verified = await verifyAuthenticationResponse({
      response, expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: registered.id, publicKey: decode(registered.public_key), counter: Number(registered.counter), transports: registered.transports },
    });
    if (!verified.verified) return reply(res, 403, { error: 'SIGNATURE_REJECTED' });
    const token = base64url(randomBytes(32));
    const { error: updateError } = await db.from('device_credentials').update({ counter: verified.authenticationInfo.newCounter }).eq('id', registered.id).eq('user_id', uid).eq('counter', registered.counter);
    if (updateError) throw updateError;
    const { error: sessionError } = await db.from('device_sessions').insert({
      token_hash: hash(token), user_id: uid, credential_id: registered.id,
      expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
    });
    if (sessionError) throw sessionError;
    return reply(res, 200, { approved: true, proof: token, expiresInSeconds: 300 });
  } catch {
    return reply(res, 403, { error: 'DEVICE_VERIFICATION_FAILED' });
  }
}
