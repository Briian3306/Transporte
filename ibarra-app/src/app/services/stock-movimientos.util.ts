import {
  AjusteStock,
  EntradaStock,
  MovimientoStockAny,
  ResumenMovimientos,
  SalidaStock,
  TransferenciaStock
} from '../models/stock.model';

export interface MovimientoRow {
  id: string;
  tipo: string;
  deposito_id: string;
  depositos?: { nombre?: string } | null;
  deposito_contraparte_id?: string | null;
  deposito_contraparte?: { nombre?: string } | null;
  insumo_id: number;
  insumo_nombre?: string;
  cantidad: number | string;
  fecha: string | Date;
  usuario_id: string;
  usuario_nombre?: string;
  motivo: string;
  observaciones?: string;
  auditoria_id?: string;
  ubicacion_id?: string;
  transferencia_id?: string;
  transferencia_sentido?: 'origen' | 'destino' | null;
  proveedor?: string;
  numero_factura?: string;
  costo_unitario?: number | string | null;
  costo_total?: number | string | null;
  solicitante?: string;
  recurso_tipo?: string;
  recurso_id?: string;
  recurso_nombre?: string;
}

export function mapMovimientoRow(row: MovimientoRow): MovimientoStockAny {
  const movimientoBase = {
    id: row.id,
    tipo: row.tipo,
    deposito_id: row.deposito_id,
    deposito_nombre: row.depositos?.nombre,
    insumo_id: row.insumo_id,
    insumo_nombre: row.insumo_nombre,
    cantidad: parseFloat(String(row.cantidad)),
    fecha: new Date(row.fecha),
    usuario_id: row.usuario_id,
    usuario_nombre: row.usuario_nombre,
    motivo: row.motivo,
    observaciones: row.observaciones,
    auditoria_id: row.auditoria_id,
    ubicacion_id: row.ubicacion_id
  };

  if (row.tipo === 'entrada') {
    return {
      ...movimientoBase,
      tipo: 'entrada',
      proveedor: row.proveedor || '',
      numero_factura: row.numero_factura || '',
      costo_unitario: row.costo_unitario ? parseFloat(String(row.costo_unitario)) : 0,
      costo_total: row.costo_total ? parseFloat(String(row.costo_total)) : 0
    } as EntradaStock;
  }

  if (row.tipo === 'ajuste') {
    return {
      ...movimientoBase,
      tipo: 'ajuste',
      auditoria_id: row.auditoria_id || ''
    } as AjusteStock;
  }

  if (row.tipo === 'transferencia') {
    return {
      ...movimientoBase,
      tipo: 'transferencia',
      transferencia_id: row.transferencia_id || '',
      deposito_contraparte_id: row.deposito_contraparte_id || '',
      deposito_contraparte_nombre: row.deposito_contraparte?.nombre,
      transferencia_sentido: row.transferencia_sentido || 'origen'
    } as TransferenciaStock;
  }

  return {
    ...movimientoBase,
    tipo: 'salida',
    solicitante: row.solicitante || '',
    recurso_tipo: row.recurso_tipo,
    recurso_id: row.recurso_id,
    recurso_nombre: row.recurso_nombre
  } as SalidaStock;
}

export function signoCantidadMovimiento(movimiento: MovimientoStockAny): '+' | '-' {
  if (movimiento.tipo === 'salida') return '-';
  if (movimiento.tipo === 'transferencia' && movimiento.transferencia_sentido === 'origen') {
    return '-';
  }
  return '+';
}

export function etiquetaTransferencia(movimiento: TransferenciaStock): string {
  const contraparte = movimiento.deposito_contraparte_nombre || 'otro depósito';
  if (movimiento.transferencia_sentido === 'destino') {
    return `Transferencia ← ${contraparte}`;
  }
  return `Transferencia → ${contraparte}`;
}

export function resumirMovimientosPorDia(
  movimientos: MovimientoStockAny[],
  dias: number = 30
): ResumenMovimientos[] {
  const ahora = new Date();
  const fechaInicio = new Date(ahora);
  fechaInicio.setDate(fechaInicio.getDate() - dias);

  const movimientosFiltrados = movimientos.filter(m => m.fecha >= fechaInicio);
  const resumenPorDia = new Map<string, ResumenMovimientos>();

  movimientosFiltrados.forEach(m => {
    const fechaKey = m.fecha.toISOString().split('T')[0];

    if (!resumenPorDia.has(fechaKey)) {
      resumenPorDia.set(fechaKey, {
        fecha: new Date(fechaKey),
        entradas: 0,
        salidas: 0,
        entradas_cantidad: 0,
        salidas_cantidad: 0
      });
    }

    const resumen = resumenPorDia.get(fechaKey)!;
    if (m.tipo === 'entrada') {
      resumen.entradas++;
      resumen.entradas_cantidad += m.cantidad;
    } else if (m.tipo === 'salida') {
      resumen.salidas++;
      resumen.salidas_cantidad += m.cantidad;
    }
  });

  return Array.from(resumenPorDia.values()).sort(
    (a, b) => a.fecha.getTime() - b.fecha.getTime()
  );
}
