const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const REPO = /^[A-Za-z0-9._-]{1,100}$/u;
const SHA = /^[a-f0-9]{40}$/iu;
const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/iu;

export function isQueryFreeHttpsApiUrl(value) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[?#]/u.test(value)) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  return url.protocol === 'https:' && !url.username && !url.password
    && !url.search && !url.hash && url.pathname.length > 1
    && hostname.includes('.') && hostname !== 'localhost'
    && !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname)
    && !hostname.endsWith('.local') && !hostname.endsWith('.internal')
    && !hostname.endsWith('.invalid') && !hostname.endsWith('.test')
    && !hostname.endsWith('.example');
}

export function deploymentIdentity(env, config) {
  const owner = env.VERCEL_GIT_REPO_OWNER;
  const repo = env.VERCEL_GIT_REPO_SLUG;
  const commit = env.VERCEL_GIT_COMMIT_SHA;
  const host = env.VERCEL_URL;
  const allowedRoutes = config?.allowedRoutes;
  if (env.VERCEL_GIT_PROVIDER !== 'github' || !OWNER.test(owner || '')
      || !REPO.test(repo || '') || repo === '.' || repo === '..'
      || repo.toLowerCase().endsWith('.git') || !SHA.test(commit || '')
      || !HOST.test(host || '') || !Number.isInteger(config?.step)
      || config.step < 1 || config.step > 5
      || (config.step >= 5 && !isQueryFreeHttpsApiUrl(config.originalApiUrl))
      || !Array.isArray(allowedRoutes) || allowedRoutes.length === 0
      || allowedRoutes.some(route => typeof route !== 'string' || !route.trim())
      || typeof config.judgeIssuer !== 'string'
      || !/^https:\/\/[a-z0-9-]+\.up\.railway\.app\/defense\/judge$/iu.test(config.judgeIssuer)) {
    throw new Error('배포 식별 정보를 확인할 수 없습니다. Vercel 시스템 환경변수와 단계 설정을 확인하세요.');
  }
  return {
    schema: 'aleph.defense.deployment.v1',
    step: config.step,
    repoUrl: `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`,
    commit: commit.toLowerCase(),
    publicAppUrl: `https://${host.toLowerCase()}`,
    judgeIssuer: config.judgeIssuer,
    allowedRoutes: [...allowedRoutes],
    originalApiUrl: config.originalApiUrl,
  };
}
