import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

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
  if (identity?.kind !== 'student' || typeof identity.userId !== 'string') {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  try {
    const supabase = createSupabaseClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!hasId && request.method === 'GET') {
      const { data, error } = await supabase
        .from('learning_memos')
        .select('id,title,content')
        .eq('owner_id', identity.userId)
        .order('created_at', { ascending: true });
      if (error) return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
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
      const memo = { owner_id: identity.userId, title, content: body };
      if (requestedId !== undefined) memo.id = requestedId;
      const { data, error } = await supabase
        .from('learning_memos')
        .insert(memo)
        .select('id')
        .single();
      if (error) {
        return response.status(error.code === '23505' ? 409 : 502)
          .json({ error: error.code === '23505' ? 'MEMO_ID_CONFLICT' : 'MEMOS_UNAVAILABLE' });
      }
      return response.status(201).json({ id: data.id });
    }

    if (request.method === 'GET') {
      const { data, error } = await supabase
        .from('learning_memos')
        .select('id,title,content')
        .eq('id', id)
        .eq('owner_id', identity.userId)
        .maybeSingle();
      if (error) return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
      if (!data) return response.status(404).json({ error: 'MEMO_NOT_FOUND' });
      return response.status(200).json(memoShape(data));
    }

    if (request.method === 'PUT') {
      if (hasOwnerOverride(request.body)) {
        return response.status(403).json({ error: 'OWNER_ID_NOT_ALLOWED' });
      }
      if (invalidMemo(request.body, false)) {
        return response.status(400).json({ error: 'INVALID_MEMO' });
      }

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
      .select('id')
      .maybeSingle();
    if (error) return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
    if (!data) return response.status(404).json({ error: 'MEMO_NOT_FOUND' });
    return response.status(204).end();
  } catch {
    return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
  }
  };
}

export default createLearningMemosHandler();