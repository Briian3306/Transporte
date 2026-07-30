import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { ExcelCargaPreview } from '../../models';

const PREVIEW_MAX_ROWS = 10;

@Injectable({ providedIn: 'root' })
export class PeajesExcelService {
  /** Solo acepta extensión .xlsx (RF-01 / RF-02). */
  esXlsxValido(file: File): boolean {
    const name = file.name.toLowerCase();
    return name.endsWith('.xlsx');
  }

  async parsearArchivo(file: File): Promise<ExcelCargaPreview> {
    if (!this.esXlsxValido(file)) {
      throw new Error('Solo se permiten archivos .xlsx');
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('El archivo no contiene hojas');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: false,
    });

    const columnas =
      rows.length > 0
        ? Object.keys(rows[0])
        : (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] as string[]) ?? [];

    const filasPreview = rows.slice(0, PREVIEW_MAX_ROWS).map((row) => {
      const out: Record<string, unknown> = {};
      for (const col of columnas) {
        out[col] = row[col] ?? null;
      }
      return out;
    });

    const tiposInferidos: Record<string, string> = {};
    for (const col of columnas) {
      tiposInferidos[col] = this.inferirTipo(
        rows.slice(0, PREVIEW_MAX_ROWS).map((r) => r[col])
      );
    }

    return {
      nombreArchivo: file.name,
      tamanioBytes: file.size,
      totalFilas: rows.length,
      columnas,
      filasPreview,
      tiposInferidos,
    };
  }

  private inferirTipo(valores: unknown[]): string {
    const noVacios = valores.filter((v) => v !== null && v !== undefined && v !== '');
    if (noVacios.length === 0) {
      return 'vacío';
    }
    if (noVacios.every((v) => v instanceof Date || this.esFechaTexto(v))) {
      return 'fecha';
    }
    if (noVacios.every((v) => this.esNumero(v))) {
      return 'número';
    }
    return 'texto';
  }

  private esNumero(v: unknown): boolean {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return true;
    }
    if (typeof v === 'string') {
      const n = Number(v.replace(',', '.').replace(/\s/g, ''));
      return v.trim() !== '' && Number.isFinite(n);
    }
    return false;
  }

  private esFechaTexto(v: unknown): boolean {
    if (typeof v !== 'string') {
      return false;
    }
    return /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(v.trim());
  }
}
