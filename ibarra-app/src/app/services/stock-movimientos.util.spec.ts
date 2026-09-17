import {
  etiquetaTransferencia,
  mapMovimientoRow,
  resumirMovimientosPorDia,
  signoCantidadMovimiento
} from './stock-movimientos.util';
import { TransferenciaStock } from '../models/stock.model';

function transferencia(partial: Partial<TransferenciaStock> = {}): TransferenciaStock {
  return {
    id: 'mov-1',
    tipo: 'transferencia',
    deposito_id: 'dep-a',
    insumo_id: 1,
    cantidad: 4,
    fecha: new Date('2026-09-10T12:00:00Z'),
    usuario_id: 'u1',
    motivo: 'Traslado',
    transferencia_id: 'tr-1',
    deposito_contraparte_id: 'dep-b',
    deposito_contraparte_nombre: 'Depósito B',
    transferencia_sentido: 'origen',
    ...partial
  };
}

describe('mapMovimientoRow', () => {
  it('mapea una transferencia con contraparte y sentido', () => {
    const movimiento = mapMovimientoRow({
      id: 'm1',
      tipo: 'transferencia',
      deposito_id: 'dep-a',
      depositos: { nombre: 'Central' },
      deposito_contraparte_id: 'dep-b',
      deposito_contraparte: { nombre: 'Taller' },
      insumo_id: 9,
      insumo_nombre: 'Filtro',
      cantidad: '3.50',
      fecha: '2026-09-10T12:00:00Z',
      usuario_id: 'u1',
      usuario_nombre: 'Ana',
      motivo: 'Traslado interno',
      transferencia_id: 'tr-1',
      transferencia_sentido: 'destino'
    });

    expect(movimiento.tipo).toBe('transferencia');
    if (movimiento.tipo !== 'transferencia') return;
    expect(movimiento.deposito_nombre).toBe('Central');
    expect(movimiento.deposito_contraparte_nombre).toBe('Taller');
    expect(movimiento.transferencia_sentido).toBe('destino');
    expect(movimiento.cantidad).toBe(3.5);
  });
});

describe('signoCantidadMovimiento', () => {
  it('marca salida y pata origen como egreso', () => {
    expect(signoCantidadMovimiento({ ...transferencia(), tipo: 'salida' } as any)).toBe('-');
    expect(signoCantidadMovimiento(transferencia({ transferencia_sentido: 'origen' }))).toBe('-');
  });

  it('marca entrada y pata destino como ingreso', () => {
    expect(signoCantidadMovimiento({ ...transferencia(), tipo: 'entrada' } as any)).toBe('+');
    expect(signoCantidadMovimiento(transferencia({ transferencia_sentido: 'destino' }))).toBe('+');
  });
});

describe('etiquetaTransferencia', () => {
  it('muestra flecha hacia la contraparte en el origen', () => {
    expect(etiquetaTransferencia(transferencia({ transferencia_sentido: 'origen' })))
      .toBe('Transferencia → Depósito B');
  });

  it('muestra flecha desde la contraparte en el destino', () => {
    expect(etiquetaTransferencia(transferencia({ transferencia_sentido: 'destino' })))
      .toBe('Transferencia ← Depósito B');
  });
});

describe('resumirMovimientosPorDia', () => {
  it('no cuenta ajustes ni transferencias como entradas o salidas', () => {
    const hoy = new Date();
    const resumen = resumirMovimientosPorDia([
      { ...transferencia(), tipo: 'entrada', fecha: hoy, cantidad: 2 } as any,
      { ...transferencia(), tipo: 'salida', fecha: hoy, cantidad: 1 } as any,
      { ...transferencia(), tipo: 'ajuste', fecha: hoy, cantidad: 8 } as any,
      transferencia({ fecha: hoy, cantidad: 5 })
    ], 30);

    expect(resumen.length).toBe(1);
    expect(resumen[0].entradas).toBe(1);
    expect(resumen[0].entradas_cantidad).toBe(2);
    expect(resumen[0].salidas).toBe(1);
    expect(resumen[0].salidas_cantidad).toBe(1);
  });
});
