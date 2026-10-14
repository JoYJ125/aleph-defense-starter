// The stage-11 engine contract does not expose a trusted browser device-registration API.
// Never accept browser assertions or installation state as proof of approval.
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  return response.status(503).json({ error: 'DEVICE_APPROVAL_SERVICE_NOT_CONFIGURED' });
}
