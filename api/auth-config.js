import config from '../aleph.config.json' with { type: 'json' };

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const provider = config.identityProvider;
  if (typeof provider?.issuer !== 'string'
      || typeof provider.publishableKey !== 'string'
      || !provider.publishableKey.trim()) {
    return response.status(500).json({ error: 'AUTH_CONFIGURATION_ERROR' });
  }

  let issuer;
  try {
    issuer = new URL(provider.issuer);
  } catch {
    return response.status(500).json({ error: 'AUTH_CONFIGURATION_ERROR' });
  }
  if (issuer.protocol !== 'https:' || issuer.pathname !== '/auth/v1') {
    return response.status(500).json({ error: 'AUTH_CONFIGURATION_ERROR' });
  }

  return response.status(200).json({ url: issuer.origin, publishableKey: provider.publishableKey });
}