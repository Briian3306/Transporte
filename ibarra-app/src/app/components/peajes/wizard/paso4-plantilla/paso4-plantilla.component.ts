import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  PEAJES_PLANTILLAS_SERVICE,
  PlantillaConfiguracion,
  PeajesPlantillasService,
  PasadaEstandarizada,
  PEAJES_CATALOGO_SERVICE,
  PeajesCatalogoService,
} from '../../models';
import { PeajesMotorTransformacionService } from '../../plantillas/motor/peajes-motor-transformacion.service';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

/**
 * Paso 4 — selecciona/aplica plantilla vía PeajesPlantillasService + motor.
 * Si hay draft del Paso 3, lo aplica a filasOrigen cuando no hay plantilla remota.
 */
@Component({
  selector: 'app-paso4-plantilla',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paso4-plantilla.component.html',
  styleUrl: './paso4-plantilla.component.css',
})
export class Paso4PlantillaComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();
  /** Salto controlado: solo cuando plantilla + catálogos dejan cero excepciones. */
  @Output() facturaDirecta = new EventEmitter<void>();

  private readonly motor = inject(PeajesMotorTransformacionService);
  readonly state = inject(PeajesWizardStateService);

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService,
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  plantillas: PlantillaConfiguracion[] = [];
  plantillaId = '';
  errores: string[] = [];
  info = 'Podés continuar sin plantilla.';

  async ngOnInit(): Promise<void> {
    this.plantillas = await firstValueFrom(this.plantillasSvc.listarPlantillas());
    const snap = this.state.snapshot();
    const prev = snap.plantillaId;
    if (prev) {
      this.plantillaId = prev;
    }
    const draftCount = snap.configuracionesDraft.length;
    if (draftCount > 0 && !prev) {
      this.info = `Hay un pipeline draft del paso 3 (${draftCount} pasos). Se aplicará al continuar si no elegís otra plantilla.`;
    }
  }

  get tieneDraft(): boolean {
    return this.state.snapshot().configuracionesDraft.length > 0;
  }

  /** Filas completas para motor; fallback a preview. */
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
      // Conservar claves extra que ya vengan en la fila
      for (const [k, v] of Object.entries(f)) {
        if (!(k in out)) out[k] = v;
      }
      return out;
    });
  }

  private aplicarDraftPipeline(): PasadaEstandarizada[] | null {
    const configs = this.state.toConfiguracionesPlantilla();
    if (!configs.length) return null;
    const columnas = this.state.columnasParaMapeo();
    const erroresValidacion = this.motor.validarDependenciasPipeline(configs, columnas);
    if (erroresValidacion.length) {
      this.errores = erroresValidacion.map(
        (e) => `${e.columna}: ${e.motivo} (valor: ${e.valor})`
      );
      return null;
    }
    const filas = this.filasParaMotor(columnas);
    return this.motor.aplicarPipeline(filas, configs);
  }

  async aplicarSeleccionada(): Promise<void> {
    this.errores = [];
    if (!this.plantillaId) {
      this.state.setPlantillaId(null);
      if (this.tieneDraft) {
        const transformadas = this.aplicarDraftPipeline();
        if (!transformadas) {
          if (!this.errores.length) {
            this.errores.push('No se pudo aplicar el pipeline draft.');
          }
          return;
        }
        this.state.setPasadasEstandarizadas(transformadas);
        this.info = `Pipeline draft aplicado (${transformadas.length} filas).`;
        return;
      }
      this.info = 'Sin plantilla: se continúa con columnas crudas / mapeo posterior.';
      return;
    }

    const plantilla = await firstValueFrom(this.plantillasSvc.obtenerPlantilla(this.plantillaId));
    if (!plantilla) {
      this.errores.push('Plantilla no encontrada');
      return;
    }

    const configs = plantilla.configuraciones ?? [];
    const columnas = this.state.columnasParaMapeo();
    const erroresValidacion = this.motor.validarDefinicionPlantilla(configs, columnas);
    if (erroresValidacion.length) {
      this.errores = erroresValidacion.map(
        (e) => `${e.columna}: ${e.motivo} (valor: ${e.valor})`
      );
      return;
    }

    const filas = this.filasParaMotor(columnas);
    const algoritmos = await firstValueFrom(this.plantillasSvc.listarAlgoritmos());
    const transformadas = this.motor.aplicarPipeline(filas, configs, algoritmos);
    this.state.setMapeos(plantilla.mapeos ?? this.mapeosDesdeConfiguraciones(configs));
    this.state.setRelacionesEstacion(
      (plantilla.estaciones_reconocidas ?? []).map((r) => ({
        valorProveedor: r.valor_proveedor,
        estacionId: r.estacion_id,
      }))
    );
    this.state.setPasadasEstandarizadas(transformadas);
    this.state.setPlantillaId(plantilla.id);
    this.info = `Plantilla «${plantilla.nombre}» aplicada vía motor (${transformadas.length} filas).`;
  }

  async continuar(): Promise<void> {
    await this.aplicarSeleccionada();
    if (this.errores.length) {
      return;
    }
    if (this.plantillaId && await this.puedeIrDirectoAFactura()) {
      this.info = 'Plantilla aplicada sin excepciones: se omiten Mapeo y Estaciones.';
      this.facturaDirecta.emit();
      return;
    }
    this.completado.emit();
  }

  async continuarSinPlantilla(): Promise<void> {
    this.plantillaId = '';
    this.state.setPlantillaId(null);
    this.errores = [];
    if (this.tieneDraft) {
      const transformadas = this.aplicarDraftPipeline();
      if (!transformadas) {
        if (!this.errores.length) {
          this.errores.push('No se pudo aplicar el pipeline draft.');
        }
        return;
      }
      this.state.setPasadasEstandarizadas(transformadas);
      this.info = `Continuando con pipeline draft (${transformadas.length} filas).`;
    }
    this.completado.emit();
  }

  private mapeosDesdeConfiguraciones(configs: PlantillaConfiguracion['configuraciones']): {
    columnaOrigen: string; columnaDestino: any; excluida: boolean;
  }[] {
    return (configs ?? [])
      .filter((c) => c.tipo === 'mapeo' || !!c.columna_destino)
      .map((c) => ({ columnaOrigen: c.nombre_columna, columnaDestino: c.columna_destino ?? null, excluida: false }));
  }

  private async puedeIrDirectoAFactura(): Promise<boolean> {
    const snap = this.state.snapshot();
    const mapeados = this.state.mapeosActivos();
    const obligatorias = ['FECHA_HORA', 'PASE_ID', 'PATENTE_ID', 'ESTACION_ID', 'PRECIO'];
    if (obligatorias.some((destino) => !mapeados.some((m) => m.columnaDestino === destino))) {
      this.info = 'La plantilla se aplicó, pero faltan mapeos requeridos: revisá Paso 5.';
      return false;
    }
    const estaciones = await firstValueFrom(this.catalogo.listarEstaciones());
    const idsEstacion = new Set(estaciones.map((e) => e.id));
    const filas = this.state.construirPasadasDesdeMapeo();
    if (!filas.length || filas.some((f) => !f.ESTACION_ID || !idsEstacion.has(String(f.ESTACION_ID)))) {
      this.info = 'La plantilla se aplicó, pero hay estaciones nuevas o sin reconocer: revisá Paso 6.';
      return false;
    }
    const patentes = await firstValueFrom(this.catalogo.listarPatentes());
    const porPatente = new Map(patentes.map((p) => [this.normalizarPatente(p.patente), p.id]));
    for (const fila of filas) {
      const patenteId = porPatente.get(this.normalizarPatente(fila.PATENTE_ID));
      if (!patenteId) {
        this.info = 'La plantilla se aplicó, pero hay patentes fuera del catálogo: revisá Paso 5.';
        return false;
      }
      fila.PATENTE_ID = patenteId;
    }
    this.state.setPasadasEstandarizadas(filas);
    return true;
  }

  private normalizarPatente(valor: unknown): string {
    return String(valor ?? '').replace(/[\s-]/g, '').toUpperCase();
  }
}
