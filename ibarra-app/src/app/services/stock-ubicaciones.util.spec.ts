import { DepositoUbicacion, StockDeposito } from '../models/stock.model';
import {
  asignablePorDefecto,
  filtrarUbicacionesAsignables,
  validarAsignacionUbicacion,
} from './stock-ubicaciones.util';

function ubicacion(partial: Partial<DepositoUbicacion> & Pick<DepositoUbicacion, 'id' | 'tipo'>): DepositoUbicacion {
  return {
    deposito_id: 'dep-1',
    parent_id: null,
    codigo: partial.codigo || 'X',
    nombre: partial.nombre || 'Ubicación',
    orden: 0,
    activo: true,
    asignable: false,
    reglas: {},
    ...partial,
  };
}

const stock: StockDeposito = {
  id: 'stock-1',
  deposito_id: 'dep-1',
  insumo_id: 1,
  cantidad_actual: 4,
  cantidad_minima: 1,
  cantidad_maxima: 10,
  punto_reorden: 2,
};

describe('asignablePorDefecto', () => {
  it('habilita solo las posiciones', () => {
    expect(asignablePorDefecto('posicion')).toBe(true);
    expect(asignablePorDefecto('zona')).toBe(false);
    expect(asignablePorDefecto('pasillo')).toBe(false);
    expect(asignablePorDefecto('estante')).toBe(false);
  });
});

describe('filtrarUbicacionesAsignables', () => {
  const zona = ubicacion({ id: 'zona', tipo: 'zona', codigo: 'Z1', asignable: false });
  const pasillo = ubicacion({ id: 'pasillo', tipo: 'pasillo', codigo: 'P3', asignable: true, activo: false });
  const posicion = ubicacion({ id: 'pos', tipo: 'posicion', codigo: '05', asignable: true });

  it('deja fuera zonas y ubicaciones inactivas', () => {
    expect(filtrarUbicacionesAsignables([zona, pasillo, posicion]).map((u) => u.id)).toEqual(['pos']);
  });

  it('conserva la ubicación actual aunque ya no sea asignable', () => {
    const ids = filtrarUbicacionesAsignables([zona, posicion], 'zona').map((u) => u.id);
    expect(ids).toEqual(['zona', 'pos']);
  });
});

describe('validarAsignacionUbicacion', () => {
  const zona = ubicacion({ id: 'zona', tipo: 'zona', asignable: false });
  const posicion = ubicacion({ id: 'pos', tipo: 'posicion', asignable: true });

  it('permite quitar la ubicación', () => {
    expect(validarAsignacionUbicacion(stock, null)).toEqual({ ok: true, motivos: [] });
  });

  it('rechaza una ubicación que no está habilitada', () => {
    const resultado = validarAsignacionUbicacion(stock, zona);
    expect(resultado.ok).toBe(false);
    expect(resultado.motivos[0]).toContain('no está habilitada');
  });

  it('permite conservar una asignación previa aunque se haya deshabilitado', () => {
    const resultado = validarAsignacionUbicacion({ ...stock, ubicacion_id: 'zona' }, zona);
    expect(resultado.ok).toBe(true);
  });

  it('acepta una posición habilitada', () => {
    expect(validarAsignacionUbicacion(stock, posicion).ok).toBe(true);
  });
});
