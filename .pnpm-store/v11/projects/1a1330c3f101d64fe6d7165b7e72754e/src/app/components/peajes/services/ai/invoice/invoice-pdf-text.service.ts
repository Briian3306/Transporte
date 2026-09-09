import { Injectable } from '@angular/core';
import { PDFParse } from 'pdf-parse';

const PDF_WORKER_SRC = '/assets/pdf-parse/pdf.worker.mjs';

export interface InvoicePdfParser {
  getInfo(): Promise<{ total: number }>;
  getText(params?: { partial?: number[] }): Promise<{ text: string }>;
  destroy(): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class InvoicePdfTextService {
  private static workerConfigured = false;

  static configureWorker(): void {
    if (InvoicePdfTextService.workerConfigured) return;
    PDFParse.setWorker(PDF_WORKER_SRC);
    InvoicePdfTextService.workerConfigured = true;
  }

  static createParser(data: ArrayBuffer): InvoicePdfParser {
    return new PDFParse({ data });
  }

  async extractText(file: File): Promise<string> {
    InvoicePdfTextService.configureWorker();
    const parser = InvoicePdfTextService.createParser(await file.arrayBuffer());
    try {
      const info = await parser.getInfo();
      const totalPages = Number(info.total);
      if (!Number.isInteger(totalPages) || totalPages < 1) {
        throw new Error('El PDF no tiene texto seleccionable.');
      }

      const pages: string[] = [];
      for (let page = 1; page <= totalPages; page += 1) {
        const result = await parser.getText({ partial: [page] });
        const text = (result.text ?? '').trim();
        if (text) {
          pages.push(text);
        }
      }

      const joined = pages.join('\n').trim();
      if (!joined) {
        throw new Error('El PDF no tiene texto seleccionable.');
      }
      return pages.join('\n');
    } finally {
      await parser.destroy();
    }
  }
}
