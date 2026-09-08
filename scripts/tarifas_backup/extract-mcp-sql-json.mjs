/**
 * Extract JSON array from an MCP execute_sql result file (untrusted-data wrapper)
 * and write it as a clean .json page.
 *
 * Usage: node extract-mcp-sql-json.mjs <mcpFile> <outJson>
 */
import fs from 'node:fs';

const [, , mcpFile, outJson] = process.argv;
if (!mcpFile || !outJson) {
  console.error('Usage: node extract-mcp-sql-json.mjs <mcpFile> <outJson>');
  process.exit(1);
}

const raw = fs.readFileSync(mcpFile, 'utf8');
const marker = /<untrusted-data-[0-9a-f-]+>\n([\s\S]*?)\n<\/untrusted-data-[0-9a-f-]+>/;

let text = raw;
const trimmed = raw.trim();
if (trimmed.startsWith('{')) {
  const outer = JSON.parse(trimmed);
  if (typeof outer.result === 'string') text = outer.result;
  else if (Array.isArray(outer.result)) {
    fs.mkdirSync(outJson.replace(/[/\\][^/\\]+$/, ''), { recursive: true });
    fs.writeFileSync(outJson, `${JSON.stringify(outer.result)}\n`);
    console.log(JSON.stringify({ outJson, rows: outer.result.length }));
    process.exit(0);
  }
}

const match = text.match(marker);
if (!match) throw new Error(`No untrusted-data JSON array in ${mcpFile}`);
const parsed = JSON.parse(match[1].trim());
if (!Array.isArray(parsed)) {
  throw new Error(`Expected JSON array in ${mcpFile}`);
}

fs.mkdirSync(outJson.replace(/[/\\][^/\\]+$/, ''), { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(parsed)}\n`);
console.log(JSON.stringify({ outJson, rows: parsed.length }));
