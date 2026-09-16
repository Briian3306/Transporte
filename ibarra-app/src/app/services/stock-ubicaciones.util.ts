import {
  DepositoUbicacion,
  ResultadoValidacionUbicacion,
  StockDeposito,
  TipoUbicacion,
} from '../models/stock.model';

export function asignablePorDefecto(tipo: TipoUbicacion): boolean {
  return tipo === 'posicion';
}

export function filtrarUbicacionesAsignables(
  ubicaciones: DepositoUbicacion[],
  ubicacionActualId?: string | null,
): DepositoUbicacion[] {
  const asignables = ubicaciones.filter((u) => u.activo && u.asignable);
  if (!ubicacionActualId || asignables.some((u) => u.id === ubicacionActualId)) {
    return asignables;
  }

  const actual = ubicaciones.find((u) => u.id === ubicacionActualId);
  return actual ? [actual, ...asignables] : asignables;
}

export function validarAsignacionUbicacion(
  stock: StockDeposito,
  ubicacion: DepositoUbicacion | null,
): ResultadoValidacionUbicacion {
  if (!ubicacion) {
    return { ok: true, motivos: [] };
  }

  if (stock.ubicacion_id === ubicacion.id) {
    return { ok: true, motivos: [] };
  }

  const motivos: string[] = [];
  if (!ubicacion.activo) {
    motivos.push('La ubicación está inactiva.');
  }
  if (!ubicacion.asignable) {
    motivos.push('Esta ubicación no está habilitada para asignar insumos.');
  }

  return { ok: motivos.length === 0, motivos };
}
