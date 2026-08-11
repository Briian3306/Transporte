import {
  agruparFilasPorFactura,
  excelTieneColumnaFactura,
  normalizarImportesDocumento,
  normalizarImportesPasada,
} from './documento.helpers';

describe('documento.helpers', () => {
  describe('excelTieneColumnaFactura', () => {
    it('requiere el nombre exacto FACTURA', () => {
      expect(excelTieneColumnaFactura(['FACTURA', 'PRECIO'])).toBeTrue();
      expect(excelTieneColumnaFactura(['factura', 'PRECIO'])).toBeFalse();
      expect(excelTieneColumnaFactura(['NUMERO', 'PRECIO'])).toBeFalse();
    });
  });

  describe('agruparFilasPorFactura', () => {
    it('agrupa por valores únicos y conserva orden de aparición', () => {
      const filas = [
        { FACTURA: '5009A020001', PRECIO: 1 },
        { FACTURA: '5009A020001', PRECIO: 2 },
        { FACTURA: '5009A020002', PRECIO: 3 },
        { FACTURA: '5009A020003', PRECIO: 4 },
        { FACTURA: '5009A020002', PRECIO: 5 },
      ];
      const grupos = agruparFilasPorFactura(filas);
      expect(grupos.map((g) => g.numeroFactura)).toEqual([
        '5009A020001',
        '5009A020002',
        '5009A020003',
      ]);
      expect(grupos[0].filas.length).toBe(2);
      expect(grupos[1].rowIndexes).toEqual([2, 4]);
      expect(grupos[2].filas.length).toBe(1);
    });

    it('omite filas con FACTURA vacía', () => {
      const grupos = agruparFilasPorFactura([
        { FACTURA: 'A', x: 1 },
        { FACTURA: '  ', x: 2 },
        { FACTURA: null, x: 3 },
      ] as Record<string, unknown>[]);
      expect(grupos.length).toBe(1);
      expect(grupos[0].filas.length).toBe(1);
    });

    it('un solo FACTURA genera un grupo', () => {
      const grupos = agruparFilasPorFactura([
        { FACTURA: 'X', a: 1 },
        { FACTURA: 'X', a: 2 },
      ]);
      expect(grupos.length).toBe(1);
      expect(grupos[0].filas.length).toBe(2);
    });
  });

  describe('normalizarImportesPasada', () => {
    it('NC: PRECIO positivo → negativo', () => {
      expect(normalizarImportesPasada('NC', { precio: 100, bonificacion: 0, importe_neto: 100 })).toEqual({
        precio: -100,
        bonificacion: 0,
        importe_neto: -100,
      });
    });

    it('NC: PRECIO ya negativo permanece negativo', () => {
      expect(normalizarImportesPasada('NC', { precio: -100, bonificacion: 0, importe_neto: -100 })).toEqual({
        precio: -100,
        bonificacion: 0,
        importe_neto: -100,
      });
    });

    it('FC: PRECIO positivo permanece positivo', () => {
      expect(normalizarImportesPasada('FC', { precio: 100, bonificacion: 10, importe_neto: 90 })).toEqual({
        precio: 100,
        bonificacion: 10,
        importe_neto: 90,
      });
    });
  });

  describe('normalizarImportesDocumento', () => {
    it('NC vuelve negativos los importes de cabecera', () => {
      expect(
        normalizarImportesDocumento('NC', {
          importe_sin_iva: 1250.5,
          bonificacion: 50,
          percepciones: 10,
          iva: 20,
          importe_total: 1280.5,
        })
      ).toEqual({
        importe_sin_iva: -1250.5,
        bonificacion: -50,
        percepciones: -10,
        iva: -20,
        importe_total: -1280.5,
      });
    });

    it('FC: bonificacion 0 permanece 0', () => {
      expect(
        normalizarImportesDocumento('FC', {
          importe_sin_iva: 100,
          bonificacion: 0,
          percepciones: 0,
          iva: 0,
          importe_total: 100,
        }).bonificacion
      ).toBe(0);
    });
  });
});
