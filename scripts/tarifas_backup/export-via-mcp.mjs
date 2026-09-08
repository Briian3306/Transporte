/**
 * Turn MCP execute_sql dump files into CSV pages.
 * Usage documented in README.md — the agent fetches pages, then:
 *
 *   node extract-mcp-sql-json.mjs <mcp.txt> data/pages/<table>/NNN.json
 *   node json-pages-to-csv.mjs <table> data/pages/<table> data/<table>.csv
 */
import { TARIFAS_NORMALIZADAS_COLUMNS, PASADAS_COLUMNS, TARIFAS_STATUS_CATALOGO_COLUMNS } from './columns.mjs';

export const PAGE_SQL = {
  tarifas_status_catalogo: `SELECT ${TARIFAS_STATUS_CATALOGO_COLUMNS.join(', ')} FROM public.tarifas_status_catalogo ORDER BY id`,
  tarifas_normalizadas: `SELECT ${TARIFAS_NORMALIZADAS_COLUMNS.join(', ')} FROM public.tarifas_normalizadas WHERE id >= $start AND id < $end ORDER BY id`,
  pasadas: `SELECT ${PASADAS_COLUMNS.join(', ')} FROM public.pasadas WHERE id >= $start AND id < $end ORDER BY id`,
};
