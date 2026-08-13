/**
 * Shared CSV / datetime / money helpers for categorias_search scripts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DOWNLOADS_DIR = path.resolve(HERE, '../downloads');
export const TELEPEAJE_PLUS_DIR = path.resolve(HERE, '../telepeaje plus');

export function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function writeCsv(filePath, headers, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

/** Minimal CSV parser supporting quoted fields and custom delimiter. */
export function parseCsv(text, delimiter = ',') {
  const rows = [];
  let i = 0;
  const len = text.length;

  const parseRow = () => {
    const fields = [];
    while (i < len) {
      let field = '';
      if (text[i] === '"') {
        i += 1;
        while (i < len) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') {
              field += '"';
              i += 2;
              continue;
            }
            i += 1;
            break;
          }
          field += text[i];
          i += 1;
        }
        fields.push(field);
        if (text[i] === delimiter) {
          i += 1;
          continue;
        }
        if (text[i] === '\r' || text[i] === '\n' || i >= len) {
          if (text[i] === '\r') i += 1;
          if (text[i] === '\n') i += 1;
          break;
        }
        continue;
      }
      while (i < len && text[i] !== delimiter && text[i] !== '\n' && text[i] !== '\r') {
        field += text[i];
        i += 1;
      }
      fields.push(field);
      if (text[i] === delimiter) {
        i += 1;
        continue;
      }
      if (text[i] === '\r') i += 1;
      if (text[i] === '\n') i += 1;
      break;
    }
    return fields;
  };

  // skip UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  while (i < len) {
    if (text[i] === '\r' || text[i] === '\n') {
      i += 1;
      continue;
    }
    rows.push(parseRow());
  }
  return rows;
}

export function csvToObjects(text, delimiter = ',') {
  const rows = parseCsv(text, delimiter);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  const out = [];
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row.length || row.every((c) => c === '')) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c += 1) {
      obj[headers[c]] = row[c] ?? '';
    }
    out.push(obj);
  }
  return out;
}

export function normalizePatente(v) {
  return String(v ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** Parse AR/EU money strings to number (or null). */
export function parseMoney(v) {
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/\s/g, '');
  // European: 13.015,92
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function moneyKey(n, digits = 4) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '';
  return Number(n).toFixed(digits);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Parse FECHA → {y,m,d} supporting YYYY-MM-DD and D/M/YYYY. */
export function parseFechaParts(fechaRaw) {
  const s = String(fechaRaw ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { y: +m[3], mo: +m[2], d: +m[1] };
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return { y: +m[3], mo: +m[2], d: +m[1] };
  return null;
}

/** Parse HORA → {h,mi,s} supporting HH:MM:SS and HHMMSS. */
export function parseHoraParts(horaRaw) {
  const s = String(horaRaw ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return { h: +m[1], mi: +m[2], s: +(m[3] ?? 0) };
  m = s.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) return { h: +m[1], mi: +m[2], s: +m[3] };
  m = s.match(/^(\d{1,2})(\d{2})(\d{2})$/);
  if (m) return { h: +m[1], mi: +m[2], s: +m[3] };
  return null;
}

export function toIsoUtcFromParts(y, mo, d, h, mi, s) {
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().replace(/\.\d{3}Z$/, '+00');
}

/**
 * Argentina (ART, UTC-3, no DST in practice for this data) → UTC ISO-like string
 * matching export style `YYYY-MM-DD HH:MM:SS+00`.
 */
export function localArToUtcIso(y, mo, d, h, mi, s) {
  const dt = new Date(Date.UTC(y, mo - 1, d, h + 3, mi, s));
  if (Number.isNaN(dt.getTime())) return null;
  const iso = dt.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}+00`;
}

export function utcPartsToExportIso(y, mo, d, h, mi, s) {
  return `${y}-${pad2(mo)}-${pad2(d)} ${pad2(h)}:${pad2(mi)}:${pad2(s)}+00`;
}

/** Normalize DB fecha_hora to `YYYY-MM-DD HH:MM:SS+00`. */
export function normalizeDbFechaHora(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}+00`;
}

/** Accept `YYYY-MM-DD HH:MM:SS+00` / `+00:00` / `Z` / ISO. */
export function epochSec(fechaHoraNorm) {
  if (!fechaHoraNorm) return null;
  let s = String(fechaHoraNorm).trim().replace(' ', 'T');
  // Node Date rejects `+00`; require `+00:00` or Z
  if (/\+\d{2}$/.test(s)) s = `${s}:00`;
  else if (/-\d{2}$/.test(s) && !/T.*-/.test(s.slice(0, 11))) {
    /* keep date-only negatives untouched */
  } else if (/[+-]\d{2}$/.test(s)) {
    s = `${s}:00`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

export function walkFiles(root, predicate) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (predicate(full, ent.name)) out.push(full);
    }
  }
  return out;
}

/** Parent folder name under downloads (concesion). */
export function concesionFromDownloadsPath(filePath) {
  const rel = path.relative(DOWNLOADS_DIR, filePath);
  const parts = rel.split(path.sep).filter(Boolean);
  return parts[0] || '';
}
