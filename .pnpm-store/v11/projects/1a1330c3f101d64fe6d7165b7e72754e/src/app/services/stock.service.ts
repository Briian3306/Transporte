import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import {
  Deposito,
  StockDeposito,
  EntradaStock,
  SalidaStock,
  EstadisticasStock,
  AlertaStock,
  ResumenMovimientos,
  FiltrosMovimiento,
  RegistroEntradaDTO,
  RegistroSalidaDTO,
  EstadoStock
} from '../models/stock.model';
import { SupabaseService } from './supabase.service';
import { ApiIbarraService } from './api-ibarra.service';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private supabaseService = inject(SupabaseService);
  private apiService = inject(ApiIbarraService);

  constructor() {}

  /**
   * Calcula el estado del stock basado en cantidades
   */
  private calcularEstadoStock(stock: StockDeposito): EstadoStock {
    if (stock.cantidad_actual <= 0) {
      return 'critico';
    } else if (stock.cantidad_minima > 0 && stock.cantidad_actual < stock.cantidad_minima) {
      return 'bajo';
    } else if (stock.cantidad_maxima > 0 && stock.cantidad_actual > stock.cantidad_maxima) {
      return 'excedido';
    }
    return 'normal';
  }

  /**
   * Enriquece el stock con información del insumo
   */
  private async enriquecerStock(stockItems: any[]): Promise<StockDeposito[]> {
    if (stockItems.length === 0) return [];

    // Obtener insumos del API
    const insumos = await this.apiService.getInsumos().toPromise();
    if (!insumos) return [];

    return stockItems.map(item => {
      const insumo = insumos.find(i => i.id === item.insumo_id);
      const stockEnriquecido: StockDeposito = {
        id: item.id,
        deposito_id: item.deposito_id,
        deposito_nombre: item.depositos?.nombre,
        insumo_id: item.insumo_id,
        insumo_nombre: insumo?.nombre,
        insumo_codigo: insumo?.codigo,
        categoria_nombre: insumo?.categoria?.nombre,
        unidad_medida: insumo?.unidad_medida,
        cantidad_actual: parseFloat(item.cantidad_actual),
        cantidad_minima: parseFloat(item.cantidad_minima),
        cantidad_maxima: parseFloat(item.cantidad_maxima),
        punto_reorden: parseFloat(item.punto_reorden),
        ultima_actualizacion: new Date(item.updated_at)
      };
      stockEnriquecido.estado = this.calcularEstadoStock(stockEnriquecido);
      return stockEnriquecido;
    });
  }

  /**
   * Obtiene todos los depósitos
   */
  getDepositos(): Observable<Deposito[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client
          .from('depositos')
          .select('*')
          .eq('activo', true)
          .order('nombre', { ascending: true });

        if (error) throw new Error(error.message);

        return (data || []).map((d: any) => ({
          id: d.id,
          nombre: d.nombre,
          descripcion: d.descripcion,
          ubicacion: d.ubicacion,
          responsable: d.responsable,
          activo: d.activo,
          fecha_creacion: new Date(d.fecha_creacion)
        }));
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener depósitos:', error);
        return of([]);
      })
    );
  }

  /**
   * Obtiene un depósito por ID
   */
  getDepositoById(id: string): Observable<Deposito | undefined> {
    return this.getDepositos().pipe(
      map(depositos => depositos.find(d => d.id === id))
    );
  }

  /**
   * Obtiene todo el stock
   */
  getStock(): Observable<StockDeposito[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client
          .from('stock_depositos')
          .select('*, depositos(nombre)')
          .order('insumo_id', { ascending: true });

        if (error) throw new Error(error.message);

        return this.enriquecerStock(data || []);
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener stock:', error);
        return of([]);
      })
    );
  }

  /**
   * Obtiene el stock de un depósito específico
   */
  getStockPorDeposito(depositoId: string): Observable<StockDeposito[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client
          .from('stock_depositos')
          .select('*, depositos(nombre)')
          .eq('deposito_id', depositoId)
          .order('insumo_id', { ascending: true });

        if (error) throw new Error(error.message);

        return this.enriquecerStock(data || []);
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener stock por depósito:', error);
        return of([]);
      })
    );
  }

  /**
   * Obtiene el stock de un insumo en un depósito
   */
  getStockInsumo(depositoId: string, insumoId: number): Observable<StockDeposito | undefined> {
    return this.getStockPorDeposito(depositoId).pipe(
      map(stock => stock.find(s => s.insumo_id === insumoId))
    );
  }

  /**
   * Registra una entrada de stock con múltiples items
   */
  registrarEntrada(entrada: RegistroEntradaDTO): Observable<EntradaStock[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const insumos = await this.apiService.getInsumos().toPromise();
        const movimientosCreados: EntradaStock[] = [];

        // Procesar cada item
        for (const item of entrada.items) {
          // Buscar o crear el stock
          const { data: stockExistente, error: errorBuscar } = await client
            .from('stock_depositos')
            .select('*')
            .eq('deposito_id', entrada.deposito_id)
            .eq('insumo_id', item.insumo_id)
            .maybeSingle();

          if (errorBuscar && errorBuscar.code !== 'PGRST116') {
            throw new Error(errorBuscar.message);
          }

          if (stockExistente) {
            // Actualizar stock existente
            const nuevaCantidad = parseFloat(stockExistente.cantidad_actual) + item.cantidad;
            const { error: errorUpdate } = await client
              .from('stock_depositos')
              .update({ cantidad_actual: nuevaCantidad })
              .eq('id', stockExistente.id);

            if (errorUpdate) throw new Error(errorUpdate.message);
          } else {
            // Crear nuevo registro de stock
            const insumoData = insumos?.find(i => i.id === item.insumo_id);

            const { error: errorInsert } = await client
              .from('stock_depositos')
              .insert({
                deposito_id: entrada.deposito_id,
                insumo_id: item.insumo_id,
                cantidad_actual: item.cantidad,
                cantidad_minima: insumoData?.stock_minimo || 10,
                cantidad_maxima: insumoData?.stock_maximo || 100,
                punto_reorden: insumoData ? Math.floor(insumoData.stock_minimo * 1.5) : 15
              });

            if (errorInsert) throw new Error(errorInsert.message);
          }

          // Registrar movimiento
          const costoUnitario = item.costo_unitario || 0;
          const movimiento = {
            tipo: 'entrada',
            deposito_id: entrada.deposito_id,
            insumo_id: item.insumo_id,
            cantidad: item.cantidad,
            usuario_id: 'user-demo',
            usuario_nombre: 'Usuario Demo',
            motivo: entrada.motivo,
            observaciones: entrada.observaciones,
            proveedor: entrada.proveedor,
            numero_factura: entrada.numero_factura,
            costo_unitario: costoUnitario,
            costo_total: item.cantidad * costoUnitario
          };

          const { data: movimientoData, error: errorMov } = await client
            .from('movimientos_stock')
            .insert(movimiento)
            .select()
            .single();

          if (errorMov) throw new Error(errorMov.message);

          movimientosCreados.push({
            ...movimiento,
            id: movimientoData.id,
            fecha: new Date(movimientoData.created_at)
          } as EntradaStock);
        }

        return movimientosCreados;
      })
    );
  }

  /**
   * Registra una salida de stock con múltiples items
   */
  registrarSalida(salida: RegistroSalidaDTO): Observable<SalidaStock[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const movimientosCreados: SalidaStock[] = [];

        // Validar stock suficiente para todos los items primero
        for (const item of salida.items) {
          const { data: stockExistente, error: errorBuscar } = await client
            .from('stock_depositos')
            .select('*')
            .eq('deposito_id', salida.deposito_id)
            .eq('insumo_id', item.insumo_id)
            .maybeSingle();

          if (errorBuscar && errorBuscar.code !== 'PGRST116') {
            throw new Error(errorBuscar.message);
          }

          if (!stockExistente) {
            const insumos = await this.apiService.getInsumos().toPromise();
            const insumo = insumos?.find(i => i.id === item.insumo_id);
            throw new Error(`Stock no encontrado para ${insumo?.nombre || 'insumo'}`);
          }

          const cantidadActual = parseFloat(stockExistente.cantidad_actual);
          if (cantidadActual < item.cantidad) {
            const insumos = await this.apiService.getInsumos().toPromise();
            const insumo = insumos?.find(i => i.id === item.insumo_id);
            throw new Error(`Stock insuficiente para ${insumo?.nombre || 'insumo'}. Disponible: ${cantidadActual}`);
          }
        }

        // Procesar cada item
        for (const item of salida.items) {
          const { data: stockExistente } = await client
            .from('stock_depositos')
            .select('*')
            .eq('deposito_id', salida.deposito_id)
            .eq('insumo_id', item.insumo_id)
            .single();

          // Actualizar stock
          const cantidadActual = parseFloat(stockExistente.cantidad_actual);
          const nuevaCantidad = cantidadActual - item.cantidad;
          const { error: errorUpdate } = await client
            .from('stock_depositos')
            .update({ cantidad_actual: nuevaCantidad })
            .eq('id', stockExistente.id);

          if (errorUpdate) throw new Error(errorUpdate.message);

          // Registrar movimiento
          const movimiento = {
            tipo: 'salida',
            deposito_id: salida.deposito_id,
            insumo_id: item.insumo_id,
            cantidad: item.cantidad,
            usuario_id: 'user-demo',
            usuario_nombre: 'Usuario Demo',
            motivo: salida.motivo,
            observaciones: salida.observaciones,
            solicitante: salida.solicitante,
            recurso_tipo: salida.recurso_tipo,
            recurso_id: salida.recurso_id,
            recurso_nombre: salida.recurso_nombre
          };

          const { data: movimientoData, error: errorMov } = await client
            .from('movimientos_stock')
            .insert(movimiento)
            .select()
            .single();

          if (errorMov) throw new Error(errorMov.message);

          movimientosCreados.push({
            ...movimiento,
            id: movimientoData.id,
            fecha: new Date(movimientoData.created_at)
          } as SalidaStock);
        }

        return movimientosCreados;
      })
    );
  }

  /**
   * Obtiene todos los movimientos
   */
  getMovimientos(): Observable<(EntradaStock | SalidaStock)[]> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client
          .from('movimientos_stock')
          .select('*, depositos(nombre)')
          .order('fecha', { ascending: false });

        if (error) throw new Error(error.message);

        // Enriquecer con información de insumos
        const insumos = await this.apiService.getInsumos().toPromise();
        
        return (data || []).map((m: any) => {
          const insumo = insumos?.find(i => i.id === m.insumo_id);
          const movimientoBase = {
            id: m.id,
            tipo: m.tipo,
            deposito_id: m.deposito_id,
            deposito_nombre: m.depositos?.nombre,
            insumo_id: m.insumo_id,
            insumo_nombre: insumo?.nombre,
            cantidad: parseFloat(m.cantidad),
            fecha: new Date(m.fecha),
            usuario_id: m.usuario_id,
            usuario_nombre: m.usuario_nombre,
            motivo: m.motivo,
            observaciones: m.observaciones
          };

          if (m.tipo === 'entrada') {
            return {
              ...movimientoBase,
              proveedor: m.proveedor,
              numero_factura: m.numero_factura,
              costo_unitario: m.costo_unitario ? parseFloat(m.costo_unitario) : 0,
              costo_total: m.costo_total ? parseFloat(m.costo_total) : 0
            } as EntradaStock;
          } else {
            return {
              ...movimientoBase,
              solicitante: m.solicitante,
              recurso_tipo: m.recurso_tipo,
              recurso_id: m.recurso_id,
              recurso_nombre: m.recurso_nombre
            } as SalidaStock;
          }
        });
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener movimientos:', error);
        return of([]);
      })
    );
  }

  /**
   * Obtiene movimientos filtrados
   */
  getMovimientosFiltrados(filtros: FiltrosMovimiento): Observable<(EntradaStock | SalidaStock)[]> {
    return this.getMovimientos().pipe(
      map(movimientos => {
        let resultado = [...movimientos];

        if (filtros.tipo) {
          resultado = resultado.filter(m => m.tipo === filtros.tipo);
        }

        if (filtros.deposito_id) {
          resultado = resultado.filter(m => m.deposito_id === filtros.deposito_id);
        }

        if (filtros.insumo_id) {
          resultado = resultado.filter(m => m.insumo_id === filtros.insumo_id);
        }

        if (filtros.fecha_desde) {
          resultado = resultado.filter(m => m.fecha >= filtros.fecha_desde!);
        }

        if (filtros.fecha_hasta) {
          resultado = resultado.filter(m => m.fecha <= filtros.fecha_hasta!);
        }

        if (filtros.recurso_tipo) {
          resultado = resultado.filter(m => 
            m.tipo === 'salida' && (m as SalidaStock).recurso_tipo === filtros.recurso_tipo
          );
        }

        return resultado;
      })
    );
  }

  /**
   * Obtiene estadísticas generales
   */
  getEstadisticas(): Observable<EstadisticasStock> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();

        // Obtener stock
        const { data: stockData } = await client
          .from('stock_depositos')
          .select('*');

        const stock = await this.enriquecerStock(stockData || []);

        // Obtener movimientos del mes
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const { data: movimientosData } = await client
          .from('movimientos_stock')
          .select('tipo')
          .gte('fecha', inicioMes.toISOString());

        const movimientosMes = movimientosData || [];
        const entradasMes = movimientosMes.filter(m => m.tipo === 'entrada').length;
        const salidasMes = movimientosMes.filter(m => m.tipo === 'salida').length;

        // Calcular estadísticas
        const itemsCriticos = stock.filter(s => s.estado === 'critico').length;
        const itemsBajoMinimo = stock.filter(s => s.estado === 'bajo').length;
        const itemsSobreMaximo = stock.filter(s => s.estado === 'excedido').length;

        // Calcular valor total
        const { data: entradasRecientes } = await client
          .from('movimientos_stock')
          .select('insumo_id, costo_unitario')
          .eq('tipo', 'entrada')
          .order('fecha', { ascending: false })
          .limit(100);

        let valorTotal = 0;
        stock.forEach(s => {
          const ultimaEntrada = entradasRecientes?.find((e: any) => e.insumo_id === s.insumo_id);
          if (ultimaEntrada && ultimaEntrada.costo_unitario) {
            valorTotal += s.cantidad_actual * parseFloat(ultimaEntrada.costo_unitario);
          }
        });

        // Contar depósitos
        const { data: depositosData } = await client
          .from('depositos')
          .select('id')
          .eq('activo', true);

        const insumosUnicos = new Set(stock.map(s => s.insumo_id));

        return {
          total_insumos: insumosUnicos.size,
          total_depositos: depositosData?.length || 0,
          valor_total: valorTotal,
          items_criticos: itemsCriticos,
          items_bajo_minimo: itemsBajoMinimo,
          items_sobre_maximo: itemsSobreMaximo,
          movimientos_mes: movimientosMes.length,
          entradas_mes: entradasMes,
          salidas_mes: salidasMes
        };
      })
    ).pipe(
      catchError(error => {
        console.error('Error al obtener estadísticas:', error);
        return of({
          total_insumos: 0,
          total_depositos: 0,
          valor_total: 0,
          items_criticos: 0,
          items_bajo_minimo: 0,
          items_sobre_maximo: 0,
          movimientos_mes: 0,
          entradas_mes: 0,
          salidas_mes: 0
        });
      })
    );
  }

  /**
   * Obtiene alertas de stock
   */
  getAlertas(): Observable<AlertaStock[]> {
    return this.getStock().pipe(
      map(stock => {
        const alertas: AlertaStock[] = [];

        stock.forEach(s => {
          if (s.estado === 'critico') {
            alertas.push({
              id: `alert-${s.id}`,
              deposito_id: s.deposito_id,
              deposito_nombre: s.deposito_nombre || '',
              insumo_id: s.insumo_id,
              insumo_nombre: s.insumo_nombre || '',
              tipo_alerta: 'critico',
              mensaje: `Stock crítico: ${s.insumo_nombre} en ${s.deposito_nombre}`,
              cantidad_actual: s.cantidad_actual,
              cantidad_referencia: s.cantidad_minima,
              severidad: 'alta',
              fecha_deteccion: new Date()
            });
          } else if (s.estado === 'bajo') {
            alertas.push({
              id: `alert-${s.id}`,
              deposito_id: s.deposito_id,
              deposito_nombre: s.deposito_nombre || '',
              insumo_id: s.insumo_id,
              insumo_nombre: s.insumo_nombre || '',
              tipo_alerta: 'minimo',
              mensaje: `Stock bajo mínimo: ${s.insumo_nombre} en ${s.deposito_nombre}`,
              cantidad_actual: s.cantidad_actual,
              cantidad_referencia: s.cantidad_minima,
              severidad: 'media',
              fecha_deteccion: new Date()
            });
          } else if (s.estado === 'excedido') {
            alertas.push({
              id: `alert-${s.id}`,
              deposito_id: s.deposito_id,
              deposito_nombre: s.deposito_nombre || '',
              insumo_id: s.insumo_id,
              insumo_nombre: s.insumo_nombre || '',
              tipo_alerta: 'maximo',
              mensaje: `Stock sobre máximo: ${s.insumo_nombre} en ${s.deposito_nombre}`,
              cantidad_actual: s.cantidad_actual,
              cantidad_referencia: s.cantidad_maxima,
              severidad: 'baja',
              fecha_deteccion: new Date()
            });
          }
        });

        // Ordenar por severidad
        const ordenSeveridad = { alta: 0, media: 1, baja: 2 };
        alertas.sort((a, b) => ordenSeveridad[a.severidad] - ordenSeveridad[b.severidad]);

        return alertas;
      })
    );
  }

  /**
   * Obtiene resumen de movimientos por período
   */
  getResumenMovimientos(dias: number = 30): Observable<ResumenMovimientos[]> {
    return this.getMovimientos().pipe(
      map(movimientos => {
        const ahora = new Date();
        const fechaInicio = new Date(ahora);
        fechaInicio.setDate(fechaInicio.getDate() - dias);

        const movimientosFiltrados = movimientos.filter(m => m.fecha >= fechaInicio);

        // Agrupar por día
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
          } else {
            resumen.salidas++;
            resumen.salidas_cantidad += m.cantidad;
          }
        });

        // Convertir a array y ordenar por fecha
        return Array.from(resumenPorDia.values()).sort((a, b) => 
          a.fecha.getTime() - b.fecha.getTime()
        );
      })
    );
  }

  /**
   * Crea un nuevo depósito
   */
  crearDeposito(deposito: Omit<Deposito, 'id' | 'fecha_creacion'>): Observable<Deposito> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client
          .from('depositos')
          .insert({
            nombre: deposito.nombre,
            descripcion: deposito.descripcion,
            ubicacion: deposito.ubicacion,
            responsable: deposito.responsable,
            activo: deposito.activo !== undefined ? deposito.activo : true
          })
          .select()
          .single();

        if (error) throw new Error(error.message);

        return {
          id: data.id,
          nombre: data.nombre,
          descripcion: data.descripcion,
          ubicacion: data.ubicacion,
          responsable: data.responsable,
          activo: data.activo,
          fecha_creacion: new Date(data.fecha_creacion)
        };
      })
    ).pipe(
      catchError(error => {
        console.error('Error al crear depósito:', error);
        throw error;
      })
    );
  }

  /**
   * Actualiza los parámetros de stock (min/max) de un insumo en un depósito
   */
  actualizarParametrosStock(
    stockId: string,
    parametros: {
      cantidad_minima?: number;
      cantidad_maxima?: number;
      punto_reorden?: number;
    }
  ): Observable<StockDeposito> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        
        // Actualizar en Supabase
        const { data, error } = await client
          .from('stock_depositos')
          .update(parametros)
          .eq('id', stockId)
          .select('*, depositos(nombre)')
          .single();

        if (error) throw new Error(error.message);

        // Enriquecer con información del insumo
        const stockEnriquecido = await this.enriquecerStock([data]);
        if (stockEnriquecido.length === 0) {
          throw new Error('No se pudo enriquecer el stock actualizado');
        }

        return stockEnriquecido[0];
      })
    ).pipe(
      catchError(error => {
        console.error('Error al actualizar parámetros de stock:', error);
        throw error;
      })
    );
  }

  /**
   * Actualiza un depósito existente
   */
  actualizarDeposito(id: string, deposito: Partial<Omit<Deposito, 'id' | 'fecha_creacion'>>): Observable<Deposito> {
    return from(
      this.supabaseService.executeWithRetry(async () => {
        const client = await this.supabaseService.getClient();
        const { data, error } = await client
          .from('depositos')
          .update(deposito)
          .eq('id', id)
          .select()
          .single();

        if (error) throw new Error(error.message);

        return {
          id: data.id,
          nombre: data.nombre,
          descripcion: data.descripcion,
          ubicacion: data.ubicacion,
          responsable: data.responsable,
          activo: data.activo,
          fecha_creacion: new Date(data.fecha_creacion)
        };
      })
    ).pipe(
      catchError(error => {
        console.error('Error al actualizar depósito:', error);
        throw error;
      })
    );
  }
}
