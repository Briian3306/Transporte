/** Argentine money and station-group helpers for Tarifario-last. */

export function parseArs(text) {
  if (text == null) return null;
  let s = String(text).trim();
  if (!s || s === '-') return null;
  s = s.replace(/\$/g, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatArs(n) {
  if (n == null || n === '') return '';
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  const [intPart, decPart] = num.toFixed(2).split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${withDots},${decPart}`;
}

export function foldName(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

export function splitEstaciones(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  if (foldName(raw) === 'ALL') return ['ALL'];
  return raw.split(',').map((p) => p.trim()).filter(Boolean);
}

export function amountsEqual(a, b, eps = 0.02) {
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= eps;
}

export function contienePrecio(importes, precio) {
  if (precio == null) return false;
  return (importes || []).some((n) => amountsEqual(n, precio));
}
