import { Inject, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
  PeajesCatalogoService,
  PeajesPlantillasService,
  PlantillaConfiguracion,
  PlantillaMapeoColumna,
} from '../../models';
import { PeajesMotorTransformacionService } from '../../plantillas/motor/peajes-motor-transformacion.service';
import { PeajesWizardStateService } from './peajes-wizard-state.service';

export type PlantillaExcepcionPaso = 5 | 6;

export interface ResultadoAplicarPlantilla {
  ok: boolean;
  errores: string[];
  /** null = sin excepciones (puede ir a Factura); 5/6 = paso a abrir. */
  excepcion: PlantillaExcepcionPaso | null;
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
    const mensaje =
      excepcion === 5
        ? `Plantilla «${plantilla.nombre}» aplicada, pero faltan mapeos o patentes: revisá Paso 5.`
        : `Plantilla «${plantilla.nombre}» aplicada, pero hay estaciones sin reconocer: revisá Paso 6.`;
    return {
      ok: true,
      errores: [],
      excepcion,
      mensaje,
      plantillaNombre: plantilla.nombre,
    };
  }

  private async aplicarAlEstado(
    plantilla: PlantillaConfiguracion
  ): Promise<Omit<ResultadoAplicarPlantilla, 'excepcion'>> {
    const configs = plantilla.configuraciones ?? [];
    const columnas = this.state.columnasParaMapeo();
    const mapeosPlantilla = plantilla.mapeos?.length
      ? plantilla.mapeos
      : this.mapeosDesdeConfiguraciones(configs);
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
    const mapeados = this.state.mapeosActivos();
    const obligatorias = ['FECHA_HORA', 'PASE_ID', 'PATENTE_ID', 'ESTACION_ID', 'PRECIO'];
    if (obligatorias.some((destino) => !mapeados.some((m) => m.columnaDestino === destino))) {
      return 5;
    }

    const estaciones = await firstValueFrom(this.catalogo.listarEstaciones());
    const idsEstacion = new Set(estaciones.map((e) => e.id));
    const filas = this.state.construirPasadasDesdeMapeo();
    if (!filas.length || filas.some((f) => !f.ESTACION_ID || !idsEstacion.has(String(f.ESTACION_ID)))) {
      return 6;
    }

    const patentes = await firstValueFrom(this.catalogo.listarPatentes());
    const porPatente = new Map(patentes.map((p) => [this.normalizarPatente(p.patente), p.id]));
    for (const fila of filas) {
      const patenteId = porPatente.get(this.normalizarPatente(fila.PATENTE_ID));
      if (!patenteId) {
        return 5;
      }
      fila.PATENTE_ID = patenteId;
    }
    this.state.setPasadasEstandarizadas(filas);
    return null;
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

  private normalizarPatente(valor: unknown): string {
    return String(valor ?? '').replace(/[\s-]/g, '').toUpperCase();
  }
}
