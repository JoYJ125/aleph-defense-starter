import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (typeof supabaseUrl !== 'string' || !supabaseUrl.trim()
      || typeof secretKey !== 'string' || !secretKey.trim()) {
    return response.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
  }

  try {
    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase
      .from('learning_memos')
      .select('title,content')
      .order('created_at', { ascending: true })
      .limit(4);

    if (error) return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
    return response.status(200).json(data ?? []);
  } catch {
    return response.status(502).json({ error: 'MEMOS_UNAVAILABLE' });
  }
}