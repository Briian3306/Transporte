import { Inject, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ConfiguracionPlantilla,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
  Peaje,
  PeajesCatalogoService,
  PeajesPlantillasService,
  PlantillaConfiguracion,
  PlantillaMapeoColumna,
  estacionPerteneceAEmpresa,
} from '../../models';
import { PeajesMotorTransformacionService } from '../../plantillas/motor/peajes-motor-transformacion.service';
import { resolvePatenteReferences } from './patente-reference.helper';
import { PeajesWizardStateService } from './peajes-wizard-state.service';

export type PlantillaExcepcionPaso = 5 | 6;
export type PlantillaExcepcionMotivo = 'mapeo' | 'patentes' | 'estaciones';

export interface ResultadoAplicarPlantilla {
  ok: boolean;
  errores: string[];
  /** null = sin excepciones (puede ir a Factura); 5/6 = paso a abrir. */
  excepcion: PlantillaExcepcionPaso | null;
  motivoExcepcion?: PlantillaExcepcionMotivo;
  mensaje: string;
  plantillaNombre?: string;
}

/**
 * Aplica una plantilla al estado del wizard (pipeline + mapeos + estaciones)
 * y evalúa si se puede saltar a Factura o hay que abrir Paso 5/6.
 */
/** Provided on the wizard injector (needs PEAJES_* service tokens). */
@Injectable()
export class PeajesPlantillaApplyService {
  private readonly motor = inject(PeajesMotorTransformacionService);
  private readonly state = inject(PeajesWizardStateService);

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService,
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  async aplicarYEvaluar(plantillaId: string): Promise<ResultadoAplicarPlantilla> {
    const plantilla = await firstValueFrom(this.plantillasSvc.obtenerPlantilla(plantillaId));
    if (!plantilla) {
      return {
        ok: false,
        errores: ['Plantilla no encontrada'],
        excepcion: null,
        mensaje: 'Plantilla no encontrada',
      };
    }

    const apply = await this.aplicarAlEstado(plantilla);
    if (!apply.ok) {
      return { ...apply, excepcion: null };
    }

    const excepcion = await this.evaluarExcepciones();
    if (excepcion === null) {
      return {
        ok: true,
        errores: [],
        excepcion: null,
        mensaje: `Plantilla «${plantilla.nombre}» aplicada sin excepciones: se omite hasta Factura.`,
        plantillaNombre: plantilla.nombre,
      };
    }
    const motivoExcepcion: PlantillaExcepcionMotivo = excepcion === 6
      ? 'estaciones'
      : (this.mapeosObligatoriosCompletos() ? 'patentes' : 'mapeo');
    const mensaje =
      excepcion === 5
        ? `Plantilla «${plantilla.nombre}» aplicada, pero faltan mapeos o patentes: revisá Paso 5.`
        : `Plantilla «${plantilla.nombre}» aplicada, pero hay estaciones sin reconocer: revisá Paso 6.`;
    return {
      ok: true,
      errores: [],
      excepcion,
      motivoExcepcion,
      mensaje,
      plantillaNombre: plantilla.nombre,
    };
  }

  async obtenerPatentesPendientes(): Promise<string[]> {
    const patentes = (await firstValueFrom(this.catalogo.listarPatentes())).filter(
      (patente) => patente.activa !== false
    );
    const snapshot = this.state.snapshot();
    const filas = snapshot.pasadasEstandarizadas.length
      ? snapshot.pasadasEstandarizadas
      : this.state.construirPasadasDesdeMapeo();
    const resultado = resolvePatenteReferences(filas, patentes);
    const excluidas = new Set(snapshot.patentesExcluidas);
    return resultado.unresolved.filter((codigo) => !excluidas.has(codigo));
  }

  async resolverSiguienteExcepcion(): Promise<PlantillaExcepcionPaso | null> {
    return this.evaluarExcepciones();
  }

  tieneMapeosObligatorios(): boolean {
    return this.mapeosObligatoriosCompletos();
  }

  private async aplicarAlEstado(
    plantilla: PlantillaConfiguracion
  ): Promise<Omit<ResultadoAplicarPlantilla, 'excepcion'>> {
    const configsBase = [...(plantilla.configuraciones ?? [])];
    const columnas = this.state.columnasParaMapeo();
    let mapeosPlantilla = plantilla.mapeos?.length
      ? [...plantilla.mapeos]
      : this.mapeosDesdeConfiguraciones(configsBase);
    const qty = this.asegurarQuantityEnPlantilla(configsBase, mapeosPlantilla);
    const { configs, mapeos } = this.asegurarBonificacionEnPlantilla(qty.configs, qty.mapeos);
    mapeosPlantilla = mapeos;
    const algoritmos = await firstValueFrom(this.plantillasSvc.listarAlgoritmos());
    const erroresValidacion = this.motor.validarDefinicionPlantilla(
      configs,
      columnas,
      algoritmos,
      mapeosPlantilla
    );
    if (erroresValidacion.length) {
      return {
        ok: false,
        errores: erroresValidacion.map((e) => `${e.columna}: ${e.motivo} (valor: ${e.valor})`),
        mensaje: 'La plantilla no es compatible con el archivo cargado.',
        plantillaNombre: plantilla.nombre,
      };
    }

    const filas = this.filasParaMotor(columnas);
    const transformadas = this.motor.aplicarPipeline(filas, configs, algoritmos);
    this.state.setMapeos(mapeosPlantilla);
    // Persistir draft con QUANTITY reparado para que Paso 3/7 puedan guardar la plantilla completa.
    this.state.setConfiguracionesDraft(
      configs.map((c) => ({
        clientId: c.id || `cfg-${c.orden}-${c.nombre_columna}`,
        orden: c.orden,
        tipo: c.tipo,
        nombre_columna: c.nombre_columna,
        columna_destino: c.columna_destino ?? null,
        algoritmo_combinado_id: c.algoritmo_combinado_id ?? null,
        configuracion: (c.configuracion as Record<string, unknown> | null) ?? null,
        obligatoria: c.obligatoria,
      }))
    );
    this.state.setRelacionesEstacion(
      (plantilla.estaciones_reconocidas ?? []).map((r) => ({
        valorProveedor: r.valor_proveedor,
        estacionId: r.estacion_id,
      }))
    );
    this.state.setPasadasEstandarizadas(transformadas);
    this.state.setPlantillaId(plantilla.id);
    this.state.setPlantillaMeta({
      id: plantilla.id,
      nombre: plantilla.nombre,
      descripcion: plantilla.descripcion ?? null,
      empresa_id: plantilla.empresa_id,
      estado: plantilla.estado,
    });

    return {
      ok: true,
      errores: [],
      mensaje: `Plantilla «${plantilla.nombre}» aplicada (${transformadas.length} filas).`,
      plantillaNombre: plantilla.nombre,
    };
  }

  private async evaluarExcepciones(): Promise<PlantillaExcepcionPaso | null> {
    if (!this.mapeosObligatoriosCompletos()) {
      return 5;
    }

    const filas = this.state.construirPasadasDesdeMapeo();
    const patentes = (await firstValueFrom(this.catalogo.listarPatentes())).filter((p) => p.activa !== false);
    const resolucionPatentes = resolvePatenteReferences(filas, patentes);
    if (resolucionPatentes.unresolved.length) {
      return 5;
    }
    this.state.setPasadasEstandarizadas(resolucionPatentes.rows);
    if (!filas.length) {
      return null;
    }

    const estaciones = await firstValueFrom(this.catalogo.listarEstaciones());
    const peajes = await this.listarPeajesCatalogo();
    const idsEstacion = new Set(estaciones.map((e) => e.id));
    if (!filas.length || filas.some((f) => !f.ESTACION_ID || !idsEstacion.has(String(f.ESTACION_ID)))) {
      return 6;
    }

    const empresaId = this.state.snapshot().empresaId;
    const simple = this.state.snapshot().modoImportacion !== 'masiva';
    if (simple && empresaId) {
      const fueraDeEmpresa = filas.some((f) => {
        const est = estaciones.find((e) => e.id === String(f.ESTACION_ID));
        return !est || !estacionPerteneceAEmpresa(est, empresaId, peajes);
      });
      if (fueraDeEmpresa) {
        this.state.setRelacionesEstacion(
          this.state.snapshot().relacionesEstacion.map((r) => {
            const est = estaciones.find((e) => e.id === r.estacionId);
            if (!est || !estacionPerteneceAEmpresa(est, empresaId, peajes)) {
              return { ...r, estacionId: null };
            }
            return r;
          })
        );
        return 6;
      }
    }

    return null;
  }

  private mapeosObligatoriosCompletos(): boolean {
    const mapeados = this.state.mapeosActivos();
    return !['FECHA_HORA', 'PATENTE_ID', 'ESTACION_ID', 'PRECIO'].some(
      (destino) => !mapeados.some((m) => m.columnaDestino === destino)
    );
  }

  private async listarPeajesCatalogo(): Promise<Peaje[]> {
    if (typeof this.catalogo.listarPeajes !== 'function') {
      return [];
    }
    return firstValueFrom(this.catalogo.listarPeajes());
  }

  private filasParaMotor(columnas: string[]): Record<string, unknown>[] {
    const s = this.state.snapshot();
    const origen =
      s.preview?.filasOrigen?.length
        ? s.preview.filasOrigen
        : (s.preview?.filasPreview ?? []);
    return origen.map((f) => {
      const out: Record<string, unknown> = {};
      for (const c of columnas) {
        out[c] = f[c];
      }
      for (const [k, v] of Object.entries(f)) {
        if (!(k in out)) out[k] = v;
      }
      return out;
    });
  }

  private mapeosDesdeConfiguraciones(
    configs: PlantillaConfiguracion['configuraciones']
  ): PlantillaMapeoColumna[] {
    return (configs ?? [])
      .filter((c) => c.tipo === 'mapeo' || !!c.columna_destino)
      .map((c) => ({
        columnaOrigen: c.nombre_columna,
        columnaDestino: (c.columna_destino as PlantillaMapeoColumna['columnaDestino']) ?? null,
        excluida: false,
      }));
  }

  /**
   * RN-07 / plantillas legacy (p. ej. AUSOL-7-2026): si falta QUANTITY en
   * pipeline o mapeos, inyecta ASIGNAR_VALOR=1 + mapeo QUANTITY→QUANTITY.
   */
  private asegurarQuantityEnPlantilla(
    configs: ConfiguracionPlantilla[],
    mapeos: PlantillaMapeoColumna[]
  ): { configs: ConfiguracionPlantilla[]; mapeos: PlantillaMapeoColumna[] } {
    const cubiertoPipeline = configs.some(
      (c) =>
        c.configuracion?.['habilitado'] !== false &&
        (c.columna_destino === 'QUANTITY' || c.nombre_columna === 'QUANTITY')
    );
    const cubiertoMapeo = mapeos.some((m) => !m.excluida && m.columnaDestino === 'QUANTITY');
    if (cubiertoPipeline && cubiertoMapeo) {
      return { configs, mapeos };
    }

    let nextConfigs = configs;
    if (!cubiertoPipeline) {
      const maxOrden = configs.length ? Math.max(...configs.map((c) => c.orden)) : 0;
      const plantillaId = configs[0]?.plantilla_id ?? 'runtime';
      nextConfigs = [
        ...configs,
        {
          id: `qty-repair-${plantillaId}`,
          plantilla_id: plantillaId,
          nombre_columna: 'QUANTITY',
          columna_destino: 'QUANTITY',
          orden: maxOrden + 10,
          tipo: 'transformacion',
          algoritmo_combinado_id: null,
          obligatoria: true,
          configuracion: {
            algoritmo_codigo: 'ASIGNAR_VALOR',
            valor: 1,
            parametros: { valor: 1 },
            habilitado: true,
          },
        },
      ];
    }

    let nextMapeos = [...mapeos];
    if (!cubiertoMapeo) {
      const idx = nextMapeos.findIndex((m) => m.columnaOrigen === 'QUANTITY');
      if (idx >= 0) {
        nextMapeos[idx] = {
          ...nextMapeos[idx],
          columnaDestino: 'QUANTITY',
          excluida: false,
        };
      } else {
        nextMapeos.push({
          columnaOrigen: 'QUANTITY',
          columnaDestino: 'QUANTITY',
          excluida: false,
        });
      }
    }

    return { configs: nextConfigs, mapeos: nextMapeos };
  }

  /**
   * Plantillas sin descuento (Autopistas / Telepase): si falta BONIFICACION en
   * mapeos, inyecta ASIGNAR_VALOR=0 + mapeo BONIFICACION→BONIFICACION.
   * No agrega pipeline si ya hay mapeo (columna real del proveedor).
   */
  private asegurarBonificacionEnPlantilla(
    configs: ConfiguracionPlantilla[],
    mapeos: PlantillaMapeoColumna[]
  ): { configs: ConfiguracionPlantilla[]; mapeos: PlantillaMapeoColumna[] } {
    const cubiertoMapeo = mapeos.some((m) => !m.excluida && m.columnaDestino === 'BONIFICACION');
    if (cubiertoMapeo) {
      return { configs, mapeos };
    }

    const cubiertoPipeline = configs.some(
      (c) =>
        c.configuracion?.['habilitado'] !== false &&
        (c.columna_destino === 'BONIFICACION' || c.nombre_columna === 'BONIFICACION')
    );

    let nextConfigs = configs;
    if (!cubiertoPipeline) {
      const maxOrden = configs.length ? Math.max(...configs.map((c) => c.orden)) : 0;
      const plantillaId = configs[0]?.plantilla_id ?? 'runtime';
      nextConfigs = [
        ...configs,
        {
          id: `bonif-repair-${plantillaId}`,
          plantilla_id: plantillaId,
          nombre_columna: 'BONIFICACION',
          columna_destino: 'BONIFICACION',
          orden: maxOrden + 10,
          tipo: 'transformacion',
          algoritmo_combinado_id: null,
          obligatoria: true,
          configuracion: {
            algoritmo_codigo: 'ASIGNAR_VALOR',
            valor: 0,
            parametros: { valor: 0 },
            habilitado: true,
          },
        },
      ];
    }

    const nextMapeos = [...mapeos];
    const idx = nextMapeos.findIndex((m) => m.columnaOrigen === 'BONIFICACION');
    if (idx >= 0) {
      nextMapeos[idx] = {
        ...nextMapeos[idx],
        columnaDestino: 'BONIFICACION',
        excluida: false,
      };
    } else {
      nextMapeos.push({
        columnaOrigen: 'BONIFICACION',
        columnaDestino: 'BONIFICACION',
        excluida: false,
      });
    }

    return { configs: nextConfigs, mapeos: nextMapeos };
  }

  private normalizarPatente(valor: unknown): string {
    return String(valor ?? '').replace(/[\s-]/g, '').toUpperCase();
  }
}
