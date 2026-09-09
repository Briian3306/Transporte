import { TemplateResourceType } from './checklist-template.model';

// Tipo de movimiento de stock
export type TipoMovimiento = 'entrada' | 'salida';

// Tipo de alerta de stock
export type TipoAlerta = 'minimo' | 'maximo' | 'critico';

// Estado del stock
export type EstadoStock = 'normal' | 'bajo' | 'critico' | 'excedido';

/**
 * Representa un depósito o almacén
 */
export interface Deposito {
  id: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  responsable: string;
  activo: boolean;
  fecha_creacion: Date;
}

/**
 * Representa el stock de un insumo en un depósito específico
 */
export interface StockDeposito {
  id: string;
  deposito_id: string;
  deposito_nombre?: string;
  insumo_id: number;
  insumo_nombre?: string;
  insumo_codigo?: string;
  categoria_nombre?: string;
  unidad_medida?: string;
  cantidad_actual: number;
  cantidad_minima: number;
  cantidad_maxima: number;
  punto_reorden: number;
  estado?: EstadoStock;
  ultima_actualizacion?: Date;
}

/**
 * Representa un movimiento de stock (entrada o salida)
 */
export interface MovimientoStock {
  id: string;
  tipo: TipoMovimiento;
  deposito_id: string;
  deposito_nombre?: string;
  insumo_id: number;
  insumo_nombre?: string;
  cantidad: number;
  fecha: Date;
  usuario_id: string;
  usuario_nombre?: string;
  motivo: string;
  observaciones?: string;
}

/**
 * Representa una entrada de stock al depósito
 */
export interface EntradaStock extends MovimientoStock {
  tipo: 'entrada';
  proveedor: string;
  numero_factura: string;
  costo_unitario: number;
  costo_total?: number;
}

/**
 * Representa una salida de stock del depósito
 */
export interface SalidaStock extends MovimientoStock {
  tipo: 'salida';
  recurso_tipo?: TemplateResourceType;
  recurso_id?: string;
  recurso_nombre?: string;
  solicitante: string;
}

/**
 * Estadísticas generales del stock
 */
export interface EstadisticasStock {
  total_insumos: number;
  total_depositos: number;
  valor_total: number;
  items_criticos: number;
  items_bajo_minimo: number;
  items_sobre_maximo: number;
  movimientos_mes: number;
  entradas_mes: number;
  salidas_mes: number;
}

/**
 * Alerta de stock
 */
export interface AlertaStock {
  id: string;
  deposito_id: string;
  deposito_nombre: string;
  insumo_id: number;
  insumo_nombre: string;
  tipo_alerta: TipoAlerta;
  mensaje: string;
  cantidad_actual: number;
  cantidad_referencia: number;
  severidad: 'baja' | 'media' | 'alta';
  fecha_deteccion: Date;
}

/**
 * Resumen de movimientos por período
 */
export interface ResumenMovimientos {
  fecha: Date;
  entradas: number;
  salidas: number;
  entradas_cantidad: number;
  salidas_cantidad: number;
}

/**
 * Filtros para historial de movimientos
 */
export interface FiltrosMovimiento {
  fecha_desde?: Date;
  fecha_hasta?: Date;
  tipo?: TipoMovimiento;
  deposito_id?: string;
  insumo_id?: number;
  recurso_tipo?: TemplateResourceType;
}

/**
 * Item individual de entrada o salida
 */
export interface ItemMovimiento {
  insumo_id: number;
  insumo_nombre?: string;
  cantidad: number;
  costo_unitario?: number;
}

/**
 * DTO para registrar una entrada de stock
 */
export interface RegistroEntradaDTO {
  deposito_id: string;
  items: ItemMovimiento[];
  proveedor: string;
  numero_factura: string;
  motivo: string;
  observaciones?: string;
}

/**
 * DTO para registrar una salida de stock
 */
export interface RegistroSalidaDTO {
  deposito_id: string;
  items: ItemMovimiento[];
  solicitante: string;
  motivo: string;
  observaciones?: string;
  recurso_tipo?: TemplateResourceType;
  recurso_id?: string;
  recurso_nombre?: string;
}

