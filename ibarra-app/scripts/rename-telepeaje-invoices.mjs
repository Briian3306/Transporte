import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultSourceRoot = path.resolve(scriptDirectory, "../../scripts/telepeaje plus");
const applyChanges = process.argv.includes("--apply");
const rootArgumentIndex = process.argv.indexOf("--root");
const sourceRoot = rootArgumentIndex >= 0
  ? path.resolve(process.argv[rootArgumentIndex + 1])
  : defaultSourceRoot;

async function exists(filePath) {
  return fs.access(filePath).then(() => true).catch(() => false);
}

async function extractInvoiceNumber(filePath) {
  const parser = new PDFParse({ data: await fs.readFile(filePath) });
  let text;
  try {
    text = (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
  return text.match(/\b\d{4}-\d{8}\b/)?.[0] ?? null;
}

async function periodDirectories() {
  return (await fs.readdir(sourceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^20\d{4}-/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function invoiceFiles(periodPath) {
  const comprobantesPath = path.join(periodPath, "Comprobantes");
  const hasComprobantes = await exists(comprobantesPath);
  const sourcePath = hasComprobantes ? comprobantesPath : periodPath;
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  const files = entries
    .filter((entry) => {
      if (!entry.isFile()) return false;
      if (hasComprobantes) return /\.pdf$/i.test(entry.name);
      return /^(FA|FB|NCA)\d+\.pdf$/i.test(entry.name) || /^\d{4}-\d{8}\.pdf$/i.test(entry.name);
    })
    .map((entry) => path.join(sourcePath, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  return { sourcePath, source: hasComprobantes ? "Comprobantes" : "period root", files };
}

async function updateJsonReferences(jsonPath, renameMap) {
  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  let changed = 0;
  for (const invoice of json.facturas ?? []) {
    const newName = renameMap.get(invoice.archivo);
    if (newName && invoice.archivo !== newName) {
      invoice.archivo = newName;
      changed += 1;
    }
  }
  if (applyChanges && changed > 0) {
    await fs.writeFile(jsonPath, `${JSON.stringify(json, null, 4)}\n`, "utf8");
  }
  return changed;
}

async function main() {
  if (!(await exists(sourceRoot))) throw new Error(`Source folder not found: ${sourceRoot}`);
  const summary = [];
  const skipped = [];
  const collisions = [];
  let renamed = 0;
  let jsonReferencesUpdated = 0;

  for (const period of await periodDirectories()) {
    const periodPath = path.join(sourceRoot, period.name);
    const { sourcePath, source, files } = await invoiceFiles(periodPath);
    const renameMap = new Map();
    const operations = [];

    for (const filePath of files) {
      const oldName = path.basename(filePath);
      let invoiceNumber;
      try {
        invoiceNumber = await extractInvoiceNumber(filePath);
      } catch (error) {
        skipped.push({ period: period.name, file: oldName, reason: String(error) });
        continue;
      }
      if (!invoiceNumber) {
        skipped.push({ period: period.name, file: oldName, reason: "Invoice number not found" });
        continue;
      }

      const newName = `${invoiceNumber}.pdf`;
      if (oldName === newName) continue;
      const targetPath = path.join(sourcePath, newName);
      if (await exists(targetPath)) {
        collisions.push({ period: period.name, source: oldName, target: newName, reason: "Target already exists" });
        continue;
      }
      renameMap.set(oldName, newName);
      operations.push({ from: oldName, to: newName, source: filePath, target: targetPath });
    }

    if (applyChanges) {
      for (const operation of operations) {
        await fs.rename(operation.source, operation.target);
        renamed += 1;
      }
      const jsonPath = path.join(sourcePath, "comprobantes.json");
      if (await exists(jsonPath)) {
        jsonReferencesUpdated += await updateJsonReferences(jsonPath, renameMap);
      }
    }

    summary.push({
      period: period.name,
      source,
      pdfs: files.length,
      plannedRenames: operations.length,
      operations: operations.map(({ from, to }) => ({ from, to })),
    });
  }

  console.log(JSON.stringify({ mode: applyChanges ? "apply" : "dry-run", sourceRoot, renamed, jsonReferencesUpdated, collisions, skipped, summary }, null, 2));
  if (collisions.length > 0 || skipped.length > 0) process.exitCode = 2;
}

await main();
