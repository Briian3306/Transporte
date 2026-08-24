import {
  detectarImportesPdf,
  normalizarImportePdf,
} from './pdf-reader-analysis.service';

describe('pdf-reader amount detection', () => {
  it('normaliza importes argentinos, símbolos y negativos', () => {
    expect(normalizarImportePdf('1.234,56')).toBe(1234.56);
    expect(normalizarImportePdf('$ 1.234,56')).toBe(1234.56);
    expect(normalizarImportePdf('- $ 1.234,56')).toBe(-1234.56);
  });

  it('reconoce subtotal, IVA y total con sus valores', () => {
    const detected = detectarImportesPdf([
      'Subtotal $ 1.234,56',
      'IVA 21% $ 259,26',
      'Total $ 1.493,82',
    ]);

    expect(detected.subtotal).toEqual([
      jasmine.objectContaining({ rawValue: '1.234,56', value: 1234.56 }),
    ]);
    expect(detected.iva).toEqual([
      jasmine.objectContaining({ rawValue: '259,26', value: 259.26 }),
    ]);
    expect(detected.total).toEqual([
      jasmine.objectContaining({ rawValue: '1.493,82', value: 1493.82 }),
    ]);
  });

  it('conserva todos los candidatos cuando Total es ambiguo', () => {
    const detected = detectarImportesPdf(['Total gravado $ 1.000,00', 'Total $ 1.210,00']);

    expect(detected.total.length).toBe(2);
    expect(detected.total.map((candidate) => candidate.value)).toEqual([1000, 1210]);
  });

  it('no inventa importes cuando una etiqueta no trae importe', () => {
    const detected = detectarImportesPdf(['Subtotal', 'IVA incluido', 'Total a pagar']);

    expect(detected.subtotal).toEqual([]);
    expect(detected.iva).toEqual([]);
    expect(detected.total).toEqual([]);
  });
});
