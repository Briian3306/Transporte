export const PRODUCTION_ORIGIN = 'https://portal.tpteibarra.ar';
export const LOCAL_ORIGIN = 'http://localhost:4200';

export function resolveBaseUrl({ local = false, envBaseUrl = '' } = {}) {
  if (local) return LOCAL_ORIGIN;
  const fromEnv = String(envBaseUrl ?? '').trim().replace(/\/$/, '');
  return fromEnv || PRODUCTION_ORIGIN;
}

export function pagePath(url) {
  try {
    return new URL(url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return String(url ?? '');
  }
}

export function isLoginUrl(url) {
  return pagePath(url) === '/login';
}

export function isCargaExpressUrl(url) {
  return pagePath(url) === '/peajes/carga-express';
}

export function isPostLoginUrl(url) {
  const path = pagePath(url);
  return path.startsWith('/dashboard') || path.startsWith('/peajes');
}
