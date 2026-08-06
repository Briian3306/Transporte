import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { ExcelCargaPreview } from '../../models';

const PREVIEW_MAX_ROWS = 10;

@Injectable({ providedIn: 'root' })
export class PeajesExcelService {
  /** Solo acepta extensión .xlsx (RF-01 / RF-02). */
  esArchivoValido(file: File): boolean {
    const name = file.name.toLowerCase();
    return name.endsWith('.xlsx') || name.endsWith('.csv');
  }

  esXlsxValido(file: File): boolean {
    return this.esArchivoValido(file);
  }

  async parsearArchivo(file: File): Promise<ExcelCargaPreview> {
    if (!this.esArchivoValido(file)) {
      throw new Error('Solo se permiten archivos .xlsx o .csv');
    }

    const esCsv = file.name.toLowerCase().endsWith('.csv');
    if (esCsv) {
      // CSV propio: SheetJS convierte `19.985,09` → number 19.98509 y rompe CONVERTIR_NUMERO_ARS.
      return this.parsearCsvComoTexto(await file.text(), file);
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('El archivo no contiene hojas');
    }

    const sheet = workbook.Sheets[sheetName];
    // raw:true conserva Date de cellDates (en el read); normalizarCelda → yyyy-MM-dd.
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });

    const columnas =
      rows.length > 0
        ? Object.keys(rows[0])
        : (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] as string[]) ?? [];

    const filasPreview = rows.slice(0, PREVIEW_MAX_ROWS).map((row) => {
      const out: Record<string, unknown> = {};
      for (const col of columnas) {
        out[col] = this.normalizarCelda(row[col]);
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
      filasOrigen: rows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const col of columnas) {
          out[col] = this.normalizarCelda(row[col]);
        }
        return out;
      }),
      tiposInferidos,
    };
  }

  /**
   * Parsea CSV conservando celdas como texto (no coerce numérico).
   * Necesario para montos AR `19.985,09` → CONVERTIR_NUMERO_ARS → 19985.09.
   */
  private parsearCsvComoTexto(texto: string, file: File): ExcelCargaPreview {
    const content = texto.replace(/^\uFEFF/, '');
    const lines = content.split(/\r?\n/);
    while (lines.length && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    if (!lines.length) {
      throw new Error('El archivo CSV está vacío');
    }

    const sep = this.detectarDelimitador(content);
    const header = this.splitCsvLine(lines[0], sep).map((h) => h.trim());
    if (!header.length || header.every((h) => !h)) {
      throw new Error('El archivo CSV no tiene encabezados');
    }

    const dataLines = lines.slice(1).filter((line) => line.length > 0);
    const filasOrigen = dataLines.map((line) => {
      const cells = this.splitCsvLine(line, sep);
      const out: Record<string, unknown> = {};
      for (let i = 0; i < header.length; i++) {
        const key = header[i];
        if (!key) continue;
        const raw = cells[i] ?? '';
        out[key] = raw === '' ? null : raw;
      }
      return out;
    });

    const filasPreview = filasOrigen.slice(0, PREVIEW_MAX_ROWS).map((row) => ({ ...row }));
    const tiposInferidos: Record<string, string> = {};
    for (const col of header) {
      if (!col) continue;
      tiposInferidos[col] = this.inferirTipo(filasPreview.map((r) => r[col]));
    }

    return {
      nombreArchivo: file.name,
      tamanioBytes: file.size,
      totalFilas: filasOrigen.length,
      columnas: header.filter(Boolean),
      filasPreview,
      filasOrigen,
      tiposInferidos,
    };
  }

  /** Split CSV/TSV line respecting double-quoted fields. */
  splitCsvLine(line: string, delimiter: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  /**
   * Normaliza celdas Excel para el motor: Date → yyyy-MM-dd (ISO, sin ambigüedad
   * DD/MM vs MM/DD ante Postgres). Deja texto/números; evita Date.toString().
   */
  private normalizarCelda(value: unknown): unknown {
    if (value == null || value === '') return value ?? null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const yyyy = value.getFullYear();
      const mm = String(value.getMonth() + 1).padStart(2, '0');
      const dd = String(value.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return value;
  }

  private detectarDelimitador(texto: string): string {
    const encabezado = texto.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
    const candidatos = [';', ',', '\t'];
    return candidatos.reduce(
      (mejor, candidato) =>
        encabezado.split(candidato).length > encabezado.split(mejor).length ? candidato : mejor,
      ';'
    );
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
      const s = v.trim().replace(/\s/g, '');
      if (!s) return false;
      // AR: 19.985,09
      if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || (s.includes('.') && s.includes(','))) {
        return true;
      }
      if (s.includes(',') && !s.includes('.')) {
        const n = Number(s.replace(',', '.'));
        return Number.isFinite(n);
      }
      const n = Number(s.replace(',', '.'));
      return Number.isFinite(n);
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
