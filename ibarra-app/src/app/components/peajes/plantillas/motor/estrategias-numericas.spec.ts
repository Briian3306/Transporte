import { getAlgorithmDescriptor } from './algorithm-descriptor';
import {
  calcularImporteNetoStrategy,
  convertirNumeroArsStrategy,
  convertirNumeroStrategy,
  eliminarIvaStrategy,
  operarNumeroStrategy,
  parseNumeroArs,
} from './strategies/estrategias-atomicas';

describe('estrategias numéricas F10', () => {
  it('mantiene el neto normal y solo elimina IVA cuando el paso está configurado', () => {
    const neto = calcularImporteNetoStrategy.ejecutar({
      fila: { PRECIO: 121, BONIFICACION: 0 }, resultado: {}, parametros: {},
    });
    const sinIva = eliminarIvaStrategy.ejecutar({
      fila: {}, resultado: { IMPORTE_NETO: 121 }, parametros: { columna: 'IMPORTE_NETO' },
    });
    expect(neto).toBe(121);
    expect(sinIva).toBe(100);
  });

  it('OPERAR_NUMERO aplica las cuatro operaciones con un valor fijo', () => {
    const base = { fila: {}, resultado: { PRECIO: 10 } };
    expect(operarNumeroStrategy.ejecutar({ ...base, parametros: { columna: 'PRECIO', operacion: 'sumar', valor: 2 } })).toBe(12);
    expect(operarNumeroStrategy.ejecutar({ ...base, parametros: { columna: 'PRECIO', operacion: 'restar', valor: 2 } })).toBe(8);
    expect(operarNumeroStrategy.ejecutar({ ...base, parametros: { columna: 'PRECIO', operacion: 'multiplicar', valor: 2 } })).toBe(20);
    expect(operarNumeroStrategy.ejecutar({ ...base, parametros: { columna: 'PRECIO', operacion: 'dividir', valor: 2 } })).toBe(5);
  });

  it('OPERAR_NUMERO rechaza división por cero en el descriptor', () => {
    const descriptor = getAlgorithmDescriptor('OPERAR_NUMERO')!;
    expect(descriptor.validar({ columna: 'PRECIO', operacion: 'dividir', valor: 0 })
      .some((error) => /cero/i.test(error.motivo))).toBeTrue();
  });

  it('CONVERTIR_NUMERO_ARS parsea 19.985,09 → 19985.09; CONVERTIR_NUMERO no', () => {
    expect(parseNumeroArs('19.985,09')).toBe(19985.09);
    expect(parseNumeroArs('44.494,48')).toBe(44494.48);
    expect(parseNumeroArs('1234,56')).toBe(1234.56);
    expect(
      convertirNumeroArsStrategy.ejecutar({
        fila: { TARIFA: '19.985,09' },
        resultado: {},
        parametros: { columna: 'TARIFA' },
      })
    ).toBe(19985.09);
    expect(
      convertirNumeroStrategy.ejecutar({
        fila: { TARIFA: '19.985,09' },
        resultado: {},
        parametros: { columna: 'TARIFA' },
      })
    ).toBeNull();
    expect(
      convertirNumeroStrategy.ejecutar({
        fila: { TARIFA: '19985.09' },
        resultado: {},
        parametros: { columna: 'TARIFA' },
      })
    ).toBe(19985.09);
  });
});
