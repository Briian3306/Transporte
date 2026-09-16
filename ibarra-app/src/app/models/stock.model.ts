import { TemplateResourceType } from './checklist-template.model';

// Tipo de movimiento de stock
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste';

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
  insumo_descripcion?: string;
  categoria_nombre?: string;
  unidad_medida?: string;
  cantidad_actual: number;
  cantidad_minima: number;
  cantidad_maxima: number;
  punto_reorden: number;
  estado?: EstadoStock;
  ultima_actualizacion?: Date;
  is_active?: boolean;
  ubicacion_id?: string | null;
  ubicacion_codigo?: string;
  ubicacion_nombre?: string;
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
  auditoria_id?: string;
  ubicacion_id?: string;
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
 * Ajuste de stock originado por una auditoría
 */
export interface AjusteStock extends MovimientoStock {
  tipo: 'ajuste';
  auditoria_id: string;
}

export type MovimientoStockAny = EntradaStock | SalidaStock | AjusteStock;

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
  ajustes_mes?: number;
}

/**
 * Conteo de alertas de stock por depósito (vista agregada)
 */
export interface AlertaStockPorDeposito {
  deposito_id: string;
  total_alertas: number;
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

export type TipoUbicacion = 'zona' | 'pasillo' | 'estante' | 'posicion';

/**
 * Reglas futuras de una ubicación. Hoy se persisten pero no se aplican.
 */
export interface UbicacionReglas {
  capacidad_maxima?: number;
  categorias_permitidas?: string[];
  categorias_excluidas?: string[];
  exclusividad?: boolean;
  incompatibilidades?: string[];
}

export interface ResultadoValidacionUbicacion {
  ok: boolean;
  motivos: string[];
}

export interface DepositoUbicacion {
  id: string;
  deposito_id: string;
  parent_id: string | null;
  tipo: TipoUbicacion;
  codigo: string;
  nombre: string;
  descripcion?: string;
  orden: number;
  activo: boolean;
  asignable: boolean;
  reglas: UbicacionReglas;
  codigo_completo?: string;
  insumos_count?: number;
  hijos?: DepositoUbicacion[];
}

export type PeriodicidadAuditoria =
  | 'semanal'
  | 'quincenal'
  | 'mensual'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'anual'
  | 'personalizada';

export interface DepositoAuditoriaConfig {
  id: string;
  deposito_id: string;
  periodicidad: PeriodicidadAuditoria;
  intervalo_dias: number;
  dias_aviso_previo: number;
  tolerancia_desvio_pct: number;
  incluir_sin_stock: boolean;
  responsable?: string;
  activo: boolean;
  proxima_fecha?: string | null;
  ultima_auditoria_total_id?: string | null;
}

export type TipoAuditoria = 'total' | 'parcial';
export type EstadoAuditoria = 'en_curso' | 'cerrada' | 'cancelada';
export type EstadoItemAuditoria =
  | 'pendiente'
  | 'ok'
  | 'con_desvio'
  | 'no_encontrado'
  | 'deteriorado';

export interface CriterioSeleccionAuditoria {
  texto?: string;
  categoria?: string;
  ubicacion_id?: string;
  estado_stock?: string;
  stock_ids?: string[];
}

export interface AuditoriaStock {
  id: string;
  deposito_id: string;
  deposito_nombre?: string;
  tipo: TipoAuditoria;
  estado: EstadoAuditoria;
  fecha_programada?: string | null;
  fecha_inicio: Date;
  fecha_cierre?: Date | null;
  usuario_inicio_id?: string;
  usuario_inicio_nombre?: string;
  usuario_cierre_id?: string;
  usuario_cierre_nombre?: string;
  observaciones?: string;
  criterio_seleccion?: CriterioSeleccionAuditoria | null;
  total_items: number;
  items_controlados: number;
  items_con_desvio: number;
  items_no_encontrados: number;
  ajustes_aplicados: boolean;
  periodicidad_snapshot?: PeriodicidadAuditoria | null;
  items?: AuditoriaStockItem[];
}

export interface AuditoriaStockItem {
  id: string;
  auditoria_id: string;
  stock_deposito_id: string;
  insumo_id: number;
  insumo_nombre?: string;
  insumo_codigo?: string;
  categoria_nombre?: string;
  unidad_medida?: string;
  ubicacion_id?: string | null;
  ubicacion_codigo?: string;
  cantidad_sistema: number;
  controlado: boolean;
  estado_item: EstadoItemAuditoria;
  cantidad_contada?: number | null;
  desvio?: number | null;
  motivo_desvio?: string;
  observaciones?: string;
  controlado_por_id?: string;
  controlado_por_nombre?: string;
  controlado_at?: Date | null;
  ajuste_movimiento_id?: string | null;
}

export interface ResumenDesviosAuditoria {
  total_items: number;
  items_controlados: number;
  items_pendientes: number;
  items_ok: number;
  items_con_desvio: number;
  items_no_encontrados: number;
  items_deteriorados: number;
  cobertura_deposito: number;
  items_deposito: number;
  desvio_neto: number;
  porcentaje_desvio: number;
  items: AuditoriaStockItem[];
}

export interface FiltrosAuditoria {
  deposito_id?: string;
  tipo?: TipoAuditoria;
  estado?: EstadoAuditoria;
}

export interface AuditoriaVencida {
  deposito_id: string;
  deposito_nombre: string;
  proxima_fecha: string;
  dias_vencida: number;
  en_curso: boolean;
}

