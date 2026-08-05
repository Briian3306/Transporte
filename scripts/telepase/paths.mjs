import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TELEPASE_DIR = __dirname;
export const HTML_PATH = path.resolve(__dirname, '../html/facturas');
export const ROWS_JSON_PATH = path.resolve(__dirname, 'rows.json');
export const AUTH_JSON_PATH = path.resolve(__dirname, 'auth.json');
export const DOWNLOADS_DIR = path.resolve(__dirname, '../downloads');
export const ERRORS_CSV_PATH = path.resolve(DOWNLOADS_DIR, 'errors.csv');
// /admin/login returns 404; public autogestión login is /login
export const LOGIN_URL = 'https://telepase.com.ar/login';
export const FACTURAS_URL = 'https://telepase.com.ar/admin/facturas';
