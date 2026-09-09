import { Injectable } from '@angular/core';
import { PDFParse } from 'pdf-parse';

export type PdfAmountKind = 'subtotal' | 'iva' | 'total';

export interface PdfAmountCandidate {
  kind: PdfAmountKind;
  label: string;
  rawValue: string;
  value: number;
  source: string;
}

export interface PdfReaderAnalysis {
  fileName: string;
  totalPages: number;
  lastPageText: string;
  tables: string[][][];
  amounts: Record<PdfAmountKind, PdfAmountCandidate[]>;
  logs: string[];
}

interface PdfInfoResult {
  total: number;
}

interface PdfTextResult {
  text: string;
}

interface PdfTableResult {
  pages?: Array<{ tables?: string[][][] }>;
}

const MONEY_PATTERN = /(-?\s*(?:AR\$|ARS|\$)?\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2}))/gi;

const AMOUNT_LABELS: Array<{ kind: PdfAmountKind; expression: RegExp }> = [
  { kind: 'subtotal', expression: /\b(?:subtotal|importe\s+sin\s+iva|neto(?:\s+gravado)?)\b/i },
  { kind: 'iva', expression: /\biva\b/i },
  { kind: 'total', expression: /\btotal(?:\s+(?:a\s+pagar|gravado))?\b/i },
];

/** Convierte un importe argentino visible en el PDF a número JavaScript. */
export function normalizarImportePdf(rawValue: string): number | null {
  const normalized = rawValue
    .replace(/\s/g, '')
    .replace(/AR\$|ARS|\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Devuelve candidatos, nunca una inferencia única. La UI decide si una categoría
 * es suficientemente clara para mostrarla como propuesta.
 */
export function detectarImportesPdf(lines: string[]): Record<PdfAmountKind, PdfAmountCandidate[]> {
  const detected: Record<PdfAmountKind, PdfAmountCandidate[]> = {
    subtotal: [],
    iva: [],
    total: [],
  };

  for (const source of lines) {
    for (const { kind, expression } of AMOUNT_LABELS) {
      const labelMatch = source.match(expression);
      if (!labelMatch) continue;

      MONEY_PATTERN.lastIndex = 0;
      const money = MONEY_PATTERN.exec(source);
      if (!money) continue;
      const value = normalizarImportePdf(money[1]);
      if (value === null) continue;

      detected[kind].push({
        kind,
        label: labelMatch[0],
        rawValue: money[1].trim().replace(/^(?:AR\$|ARS|\$)\s*/i, ''),
        value,
        source,
      });
    }
  }

  return detected;
}

@Injectable({ providedIn: 'root' })
export class PdfReaderAnalysisService {
  private workerConfigured = false;

  async analizar(file: File): Promise<PdfReaderAnalysis> {
    this.configureWorker();
    const logs = [`Archivo seleccionado: ${file.name}`, 'Leyendo PDF en el navegador…'];
    const parser = new PDFParse({ data: await file.arrayBuffer() });

    try {
      const info = (await parser.getInfo()) as PdfInfoResult;
      const totalPages = Number(info.total);
      if (!Number.isInteger(totalPages) || totalPages < 1) {
        throw new Error('No se pudo identificar una página válida en el PDF.');
      }

      logs.push(`${totalPages} página${totalPages === 1 ? '' : 's'} detectada${totalPages === 1 ? '' : 's'}.`);
      logs.push(`Extrayendo texto y tablas de la página ${totalPages}…`);

      const [textResult, tableResult] = await Promise.all([
        parser.getText({ partial: [totalPages] }) as Promise<PdfTextResult>,
        parser.getTable({ partial: [totalPages] }) as Promise<PdfTableResult>,
      ]);
      const lastPageText = textResult.text ?? '';
      const tables = tableResult.pages?.[0]?.tables ?? [];
      const lines = [...lastPageText.split(/\r?\n/), ...tables.flat(2).map(String)];
      const amounts = detectarImportesPdf(lines);
      const candidateCount = Object.values(amounts).reduce((count, candidates) => count + candidates.length, 0);

      logs.push(lastPageText.trim() ? 'Texto de última página extraído.' : 'La última página no devolvió texto seleccionable.');
      logs.push(`${tables.length} tabla${tables.length === 1 ? '' : 's'} detectada${tables.length === 1 ? '' : 's'} en la última página.`);
      logs.push(`${candidateCount} coincidencia${candidateCount === 1 ? '' : 's'} de importes encontrada${candidateCount === 1 ? '' : 's'}.`);

      return { fileName: file.name, totalPages, lastPageText, tables, amounts, logs };
    } finally {
      await parser.destroy();
    }
  }

  private configureWorker(): void {
    if (this.workerConfigured) return;
    PDFParse.setWorker('/assets/pdf-parse/pdf.worker.mjs');
    this.workerConfigured = true;
  }
}
