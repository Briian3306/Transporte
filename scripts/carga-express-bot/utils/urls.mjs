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
