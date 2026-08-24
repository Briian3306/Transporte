#!/usr/bin/env node
/**
 * Opt-in live regression for invoice AI fixtures.
 * Run from ibarra-app:
 *   node scripts/verify-invoice-ai-fixtures.mjs
 * Live path (paid/external OpenRouter calls) is disabled unless:
 *   RUN_OPENROUTER_LIVE_TESTS=1
 *
 * Never prints PDF text, Authorization headers, or secret values.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ibarraAppRoot = join(__dirname, '..');
const repoRoot = join(ibarraAppRoot, '..');
const testingDir = join(ibarraAppRoot, 'docs', 'plan', 'invoice-ai', 'testing');
const manifestPath = join(testingDir, 'invoice-ai-fixtures.json');
const handlerPath = join(repoRoot, 'netlify', 'functions', 'peajes-invoice-ai.js');

const LIVE_FLAG = 'RUN_OPENROUTER_LIVE_TESTS';

function printSkipAndExit() {
  console.log('Live OpenRouter fixture tests skipped (opt-in only; not run in CI by default).');
  console.log('To enable two real model calls against the historical PDFs:');
  console.log("  Windows PowerShell:  $env:RUN_OPENROUTER_LIVE_TESTS='1'; node scripts/verify-invoice-ai-fixtures.mjs");
  console.log('  Unix:                RUN_OPENROUTER_LIVE_TESTS=1 node scripts/verify-invoice-ai-fixtures.mjs');
  process.exit(0);
}

if (process.env[LIVE_FLAG] !== '1') {
  printSkipAndExit();
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  const text = readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

loadEnvFile(join(ibarraAppRoot, '.env'));
loadEnvFile(join(ibarraAppRoot, '.env.local'));
loadEnvFile(join(repoRoot, '.env'));
loadEnvFile(join(repoRoot, '.env.local'));

function toIntegerCents(value) {
  if (value == null || value === '') {
    return null;
  }
  const n =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.round(n);
}

function toIsoCalendarDate(value) {
  if (value == null) {
    return '';
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function firstCandidateValue(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return undefined;
  }
  return candidates[0]?.value;
}

function topValues(result) {
  return {
    factura: String(firstCandidateValue(result.invoice_number_candidates) ?? ''),
    fechaFactura: toIsoCalendarDate(firstCandidateValue(result.invoice_date_candidates)),
    iva: toIntegerCents(firstCandidateValue(result.vat_candidates)),
    percepciones: toIntegerCents(firstCandidateValue(result.perception_candidates)),
    importeTotal: toIntegerCents(firstCandidateValue(result.total_candidates)),
  };
}

function parseStructuredBody(body) {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  if (parsed && Array.isArray(parsed.invoice_number_candidates)) {
    return parsed;
  }
  if (parsed?.data && Array.isArray(parsed.data.invoice_number_candidates)) {
    return parsed.data;
  }
  const content = parsed?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    const jsonString = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(jsonString);
  }
  if (Array.isArray(content)) {
    const jsonString = content.map((item) => item?.text ?? '').join('');
    return JSON.parse(jsonString);
  }
  throw new Error('Handler body did not contain structured invoice candidates.');
}

function expectedTopValues(fixture) {
  return {
    factura: fixture.expected.factura,
    fechaFactura: fixture.expected.fechaFactura,
    iva: toIntegerCents(fixture.expected.iva),
    percepciones: toIntegerCents(fixture.expected.percepciones),
    importeTotal: toIntegerCents(fixture.expected.importeTotal),
  };
}

function valuesEqual(actual, expected) {
  return (
    actual.factura === expected.factura &&
    actual.fechaFactura === expected.fechaFactura &&
    actual.iva === expected.iva &&
    actual.percepciones === expected.percepciones &&
    actual.importeTotal === expected.importeTotal
  );
}

async function extractInvoiceText(pdfPath, PDFParse) {
  const data = await readFile(pdfPath);
  const parser = new PDFParse({ data });
  try {
    const textResult = await parser.getText();
    const pages = Array.isArray(textResult.pages) ? textResult.pages : [];
    const joined = pages
      .map((page) => String(page?.text ?? '').trim())
      .filter((text) => text.length > 0)
      .join('\n');
    const fallback = String(textResult.text ?? '').trim();
    const invoiceText = joined || fallback;
    if (!invoiceText) {
      throw new Error(`${basename(pdfPath)}: extracted text is blank`);
    }
    return invoiceText;
  } finally {
    await parser.destroy();
  }
}

async function main() {
  if (!existsSync(manifestPath)) {
    throw new Error(`Fixture manifest missing: ${manifestPath}`);
  }
  if (!existsSync(handlerPath)) {
    throw new Error(
      'netlify/functions/peajes-invoice-ai.js is missing (createHandler). Live fixtures wait on the code sibling.'
    );
  }

  const fixtures = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    throw new Error('Fixture manifest is empty.');
  }

  const requireFromApp = createRequire(join(ibarraAppRoot, 'package.json'));
  const { PDFParse } = requireFromApp('pdf-parse');
  if (typeof PDFParse.setWorker === 'function') {
    PDFParse.setWorker();
  }

  const requireFromHandler = createRequire(handlerPath);
  const handlerModule = requireFromHandler(handlerPath);
  if (typeof handlerModule.createHandler !== 'function') {
    throw new Error('peajes-invoice-ai.js does not export createHandler({ fetchImpl, env }).');
  }

  const handler = handlerModule.createHandler({
    fetchImpl: fetch,
    env: process.env,
  });

  let failed = 0;

  for (const fixture of fixtures) {
    const pdfPath = join(testingDir, fixture.fileName);
    if (!existsSync(pdfPath)) {
      console.log(`${fixture.fileName}  FAIL  missing PDF`);
      failed += 1;
      continue;
    }

    const invoiceText = await extractInvoiceText(pdfPath, PDFParse);
    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceText,
        expectedNetAmount: fixture.expectedNetAmount,
      }),
    };

    const response = await handler(event);
    const statusCode = response?.statusCode;
    if (statusCode !== 200) {
      console.log(
        `${fixture.fileName}  net=${fixture.expectedNetAmount}  FAIL  handler status ${statusCode}`
      );
      failed += 1;
      continue;
    }

    const structured = parseStructuredBody(response.body);
    const actual = topValues(structured);
    const expected = expectedTopValues(fixture);
    const pass = valuesEqual(actual, expected);
    console.log(
      `${fixture.fileName}  net=${fixture.expectedNetAmount}  selected=${JSON.stringify(actual)}  ${pass ? 'PASS' : 'FAIL'}`
    );
    if (!pass) {
      failed += 1;
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(`Live fixture runner failed: ${message}`);
  process.exit(1);
});
