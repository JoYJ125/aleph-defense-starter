import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const STARTER_MEMOS = [
  { key: 'assignment', title: '과제', content: '실습용 가상 과제 기록' },
  { key: 'portfolio', title: '포트폴리오', content: '실습용 가상 포트폴리오 기록' },
  { key: 'morning-ritual', title: '아침 리추얼', content: '실습용 가상 리추얼 기록' },
  { key: 'training-admin', title: '훈련 행정 자료', content: '실습용 가상 행정 기록' },
];

function starterMemoId(userId, key) {
  // Use the verified user's UUID as an RFC 4122 namespace. A template gets the
  // same ID on every request for that user, but a different ID for another user.
  const namespace = Buffer.from(userId.replaceAll('-', ''), 'hex');
  const digest = createHash('sha1').update(namespace).update(key, 'utf8').digest().subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function memoShape(row) {
  return { id: row.id, title: row.title, body: row.content };
}

function invalidMemo(body, allowId) {
  return !body || typeof body !== 'object' || Array.isArray(body)
    || (allowId && body.id !== undefined && (typeof body.id !== 'string' || !UUID.test(body.id)))
    || typeof body.title !== 'string' || !body.title.trim()
    || typeof body.body !== 'string' || !body.body.trim();
}

function hasOwnerOverride(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
    && Object.hasOwn(body, 'owner_id');
}

async function ensureStarterMemos(supabase, userId) {
  const starterRows = STARTER_MEMOS.map(memo => ({
    id: starterMemoId(userId, memo.key),
    owner_id: userId,
    title: memo.title,
    content: memo.content,
  }));
  const starterIds = starterRows.map(memo => memo.id);

  // Ignore existing IDs so a later list request never replaces a user's edits.
  const { error: upsertError } = await supabase
    .from('learning_memos')
    .upsert(starterRows, { onConflict: 'id', ignoreDuplicates: true });
  if (upsertError) throw upsertError;

  // Verify every deterministic ID still belongs to this verified user.
  const { data, error } = await supabase
    .from('learning_memos')
    .select('id,owner_id')
    .in('id', starterIds);
  if (error) throw error;
  const ownedIds = new Set((data ?? [])
    .filter(memo => memo.owner_id === userId)
    .map(memo => memo.id));
  if (ownedIds.size !== starterRows.length) {
    throw new Error('Starter memo ownership verification failed.');
  }
}

export function createLearningMemosHandler({
  createSupabaseClient = createClient,
  verifyAuthorization,
} = {}) {
  let verifyLoginAuthorization = verifyAuthorization;

  return async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  const id = request.memoId;
  const hasId = id !== undefined;
  const allowedMethods = hasId ? ['GET', 'PUT', 'DELETE'] : ['GET', 'POST'];
  if (!allowedMethods.includes(request.method)) {
    response.setHeader('Allow', allowedMethods.join(', '));
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  if (hasId && (typeof id !== 'string' || !UUID.test(id))) {
    return response.status(400).json({ error: 'INVALID_MEMO_ID' });
  }

  const authorization = request.headers?.authorization;
  if (typeof authorization !== 'string' || !authorization.trim()) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (typeof supabaseUrl !== 'string' || !supabaseUrl.trim()
      || typeof secretKey !== 'string' || !secretKey.trim()) {
    return response.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
  }

  let supabaseOrigin;
  let authOrigin;
  try {
    supabaseOrigin = new URL(supabaseUrl).origin;
    authOrigin = new URL(config.identityProvider.issuer).origin;
  } catch {
    return response.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
  }
  if (supabaseOrigin !== authOrigin) {
    return response.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
  }

  try {
    if (!verifyLoginAuthorization) {
      verifyLoginAuthorization = createLoginVerifier({ config, supabaseSecretKey: secretKey });
    }
  } catch {
    return response.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
  }

  let identity;
  try {
    identity = await verifyLoginAuthorization(authorization);
  } catch {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }
  if (identity?.kind !== 'student' || typeof identity.userId !== 'string'
      || !UUID.test(identity.userId)) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  try {
    const supabase = createSupabaseClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!hasId && request.method === 'GET') {
      // Provision the four virtual starter memos once per verified user.
      await ensureStarterMemos(supabase, identity.userId);
      const { data, error } = await supabase
        .from('learning_memos')
        .select('id,title,content,owner_id')
        .eq('owner_id', identity.userId)
        .order('created_at', { ascending: true });
      if (error) return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
      if ((data ?? []).some(memo => memo.owner_id !== identity.userId)) {
        return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
      }
      return response.status(200).json((data ?? []).map(memoShape));
    }

    if (!hasId && request.method === 'POST') {
      if (hasOwnerOverride(request.body)) {
        return response.status(403).json({ error: 'OWNER_ID_NOT_ALLOWED' });
      }
      if (invalidMemo(request.body, true)) {
        return response.status(400).json({ error: 'INVALID_MEMO' });
      }
      const { id: requestedId, title, body } = request.body;
      // Never accept a client-supplied owner: use only the verified login identity.
      const memo = { owner_id: identity.userId, title, content: body };
      if (requestedId !== undefined) memo.id = requestedId;
      const { data, error } = await supabase
        .from('learning_memos')
        .insert(memo)
        .select('id,title,content,owner_id')
        .single();
      if (error) {
        return response.status(error.code === '23505' ? 409 : 502)
          .json({ error: error.code === '23505' ? 'MEMO_ID_CONFLICT' : 'MEMOS_UNAVAILABLE' });
      }
      if (!data || data.owner_id !== identity.userId) {
        return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
      }
      return response.status(201).json(memoShape(data));
    }

    if (request.method === 'GET') {
      const { data, error } = await supabase
        .from('learning_memos')
        .select('id,title,content,owner_id')
        .eq('id', id)
        .eq('owner_id', identity.userId)
        .maybeSingle();
      if (error) return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
      if (!data || data.owner_id !== identity.userId) {
        return response.status(404).json({ error: 'MEMO_NOT_FOUND' });
      }
      return response.status(200).json(memoShape(data));
    }

    if (request.method === 'PUT') {
      if (hasOwnerOverride(request.body)) {
        return response.status(403).json({ error: 'OWNER_ID_NOT_ALLOWED' });
      }
      if (invalidMemo(request.body, false)) {
        return response.status(400).json({ error: 'INVALID_MEMO' });
      }

      // Check the current row's owner, then repeat the owner predicate on UPDATE
      // so a change between lookup and update cannot modify another user's row.
      const { data: existingMemo, error: lookupError } = await supabase
        .from('learning_memos')
        .select('id,owner_id')
        .eq('id', id)
        .maybeSingle();
      if (lookupError) return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
      if (!existingMemo || existingMemo.owner_id !== identity.userId) {
        return response.status(404).json({ error: 'MEMO_NOT_FOUND' });
      }

      const { title, body } = request.body;
      const { data, error } = await supabase
        .from('learning_memos')
        .update({ title, content: body })
        .eq('id', id)
        .eq('owner_id', identity.userId)
        .select('id,title,content,owner_id')
        .maybeSingle();
      if (error) return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
      if (!data || data.owner_id !== identity.userId) {
        return response.status(404).json({ error: 'MEMO_NOT_FOUND' });
      }
      return response.status(200).json(memoShape(data));
    }

    const { data, error } = await supabase
      .from('learning_memos')
      .delete()
      .eq('id', id)
      .eq('owner_id', identity.userId)
      .select('id,owner_id')
      .maybeSingle();
    if (error) return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
    if (!data || data.owner_id !== identity.userId) {
      return response.status(404).json({ error: 'MEMO_NOT_FOUND' });
    }
    return response.status(204).end();
  } catch {
    return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
  }
  };
}

export default createLearningMemosHandler();
