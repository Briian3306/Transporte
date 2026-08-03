import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AlgoritmoCombinado,
  ConfiguracionPlantilla,
  Empresa,
  PlantillaConfiguracion,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
  PeajesCatalogoService,
  PeajesPlantillasService,
} from '../models';
import { EstadoRecursoPeaje, PASADA_COLUMN_KEYS } from '../models/peajes.types';
import { PeajesMotorTransformacionService } from './motor/peajes-motor-transformacion.service';
import { PeajesWizardStateService } from '../wizard/services/peajes-wizard-state.service';
import {
  COLUMNAS_ARCHIVO_DEMO,
  FILA_EJEMPLO_PRD_21,
} from './mocks/peajes-plantillas.mock';
import { validarPublicacionPlantilla } from './validacion/plantillas-validacion';

interface ConfigDraft {
  nombre_columna: string;
  columna_destino: string;
  orden: number;
  tipo: string;
  algoritmo_codigo: string;
  algoritmo_combinado_id: string;
  obligatoria: boolean;
  parametrosJson: string;
}

/**
 * Builder / editor de plantillas (F03-2, F03-3).
 * Persistencia vía PeajesPlantillasService (Supabase F01).
 */
@Component({
  selector: 'app-plantilla-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plantilla-builder.component.html',
  styleUrl: './plantillas-shared.css',
})
export class PlantillaBuilderComponent implements OnInit {
  private readonly motor = inject(PeajesMotorTransformacionService);
  private readonly route = inject(ActivatedRoute);
  private readonly wizardState = inject(PeajesWizardStateService);

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService,
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  plantillaId: string | null = null;
  nombre = '';
  descripcion = '';
  empresaId = '';
  empresas: Empresa[] = [];
  estado: EstadoRecursoPeaje = 'borrador';
  configs: ConfigDraft[] = [];
  algoritmos: AlgoritmoCombinado[] = [];
  codigosDisponibles: string[] = [];
  columnasDestino = PASADA_COLUMN_KEYS;

  mensaje: string | null = null;
  error: string | null = null;
  erroresValidacion: string[] = [];
  previewResultado: Record<string, unknown> | null = null;
  guardando = false;

  async ngOnInit(): Promise<void> {
    this.codigosDisponibles = this.motor.getRegistry().codigos();
    this.plantillasSvc.listarAlgoritmos().subscribe((a) => (this.algoritmos = a));
    this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
    if (!this.empresaId && this.empresas.length) {
      this.empresaId = this.empresas[0].id;
    }

    if (this.route.snapshot.queryParamMap.get('desdeWizard') === '1' && this.prellenarDesdeWizard()) {
      return;
    }

    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const match = path.match(/plantillas\/([^/]+)$/);
    if (match && match[1] !== 'nueva' && match[1] !== 'algoritmos') {
      this.plantillaId = match[1];
      this.cargar(match[1]);
    } else {
      this.agregarConfig();
    }
  }

  cargar(id: string): void {
    this.plantillasSvc.obtenerPlantilla(id).subscribe((p) => {
      if (!p) {
        this.error = 'Plantilla no encontrada';
        return;
      }
      this.aplicarPlantilla(p);
    });
  }

  /** Carga demo ?21 para edici?n r?pida. */
  cargarDemo(): void {
    this.plantillasSvc.obtenerPlantilla('plt-demo-pasadas').subscribe((p) => {
      if (p) {
        this.plantillaId = p.id;
        this.aplicarPlantilla(p);
        this.mensaje = 'Plantilla demo ?21 cargada';
      }
    });
  }

  /** Convierte el estado vigente del wizard en un borrador editable, sin persistirlo. */
  private prellenarDesdeWizard(): boolean {
    const snap = this.wizardState.snapshot();
    const mapeos = snap.mapeos.filter((m) => !m.excluida && !!m.columnaDestino);
    if (!mapeos.length) {
      return false;
    }

    const nombreArchivo = snap.preview?.nombreArchivo?.replace(/\.[^.]+$/, '') || 'carga actual';
    this.nombre = `Plantilla · ${nombreArchivo}`;
    this.descripcion = 'Borrador creado desde el wizard de carga de Peajes.';
    this.empresaId = snap.factura.empresa_id || 'empresa-demo';
    this.estado = 'borrador';
    this.configs = mapeos.map((m, index) => ({
      nombre_columna: m.columnaOrigen,
      columna_destino: m.columnaDestino || '',
      orden: (index + 1) * 10,
      tipo: 'mapeo',
      algoritmo_codigo: 'COPIAR_COLUMNA',
      algoritmo_combinado_id: '',
      obligatoria: true,
      parametrosJson: '{}',
    }));
    this.mensaje = 'Borrador prellenado con las columnas y mapeos actuales del wizard.';
    return true;
  }

  private aplicarPlantilla(p: PlantillaConfiguracion): void {
    this.nombre = p.nombre;
    this.descripcion = p.descripcion ?? '';
    this.empresaId = p.empresa_id;
    this.estado = p.estado;
    this.configs = (p.configuraciones ?? []).map((c) => this.toDraft(c));
  }

  agregarConfig(): void {
    const nextOrden =
      this.configs.reduce((max, c) => Math.max(max, c.orden), 0) + 10;
    this.configs.push({
      nombre_columna: '',
      columna_destino: '',
      orden: nextOrden,
      tipo: 'transformacion',
      algoritmo_codigo: 'COPIAR_COLUMNA',
      algoritmo_combinado_id: '',
      obligatoria: true,
      parametrosJson: '{}',
    });
  }

  quitarConfig(i: number): void {
    this.configs.splice(i, 1);
  }

  previsualizar(): void {
    this.error = null;
    try {
      const { configs, algoritmos } = this.buildPayload();
      const rows = this.motor.aplicarPipeline(
        [FILA_EJEMPLO_PRD_21],
        configs,
        algoritmos
      );
      this.previewResultado = rows[0] ?? null;
      this.mensaje = 'Preview generado con fila ?21';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error en preview';
      this.previewResultado = null;
    }
  }

  guardar(): void {
    this.error = null;
    this.mensaje = null;
    this.erroresValidacion = [];

    let configs: ConfiguracionPlantilla[];
    let algoritmos: AlgoritmoCombinado[];
    try {
      const built = this.buildPayload();
      configs = built.configs;
      algoritmos = built.algoritmos;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Definici?n inv?lida';
      return;
    }

    const validacion = validarPublicacionPlantilla(
      { nombre: this.nombre, empresa_id: this.empresaId, estado: this.estado },
      configs,
      this.motor.getRegistry(),
      algoritmos
    );
    if (!validacion.ok) {
      this.erroresValidacion = validacion.errores.map((e) => e.motivo);
      this.error = 'No se puede guardar: hay errores de validaci?n';
      return;
    }

    this.guardando = true;
    const meta = {
      id: this.plantillaId ?? undefined,
      nombre: this.nombre,
      descripcion: this.descripcion || null,
      empresa_id: this.empresaId,
      estado: this.estado,
    };

    const configsOmit = configs.map(({ id: _id, plantilla_id: _p, ...rest }) => rest);

    if (this.plantillaId) {
      // F03-3: sobrescritura controlada en una sola operaci?n
      this.plantillasSvc
        .guardarPlantilla(meta, configsOmit)
        .subscribe({
          next: (saved) => {
            this.plantillasSvc
              .sobrescribirConfiguraciones(saved.id, configsOmit)
              .subscribe({
                next: () => {
                  this.plantillaId = saved.id;
                  this.guardando = false;
                  this.mensaje =
                    'Plantilla actualizada: configuraciones sobrescritas en una operaci?n';
                },
                error: (err) => {
                  this.guardando = false;
                  this.error = err?.message ?? 'Error al sobrescribir';
                },
              });
          },
          error: (err) => {
            this.guardando = false;
            this.error = err?.message ?? 'Error al guardar';
          },
        });
    } else {
      this.plantillasSvc.guardarPlantilla(meta, configsOmit).subscribe({
        next: (saved) => {
          this.plantillaId = saved.id;
          this.guardando = false;
          this.mensaje = `Plantilla guardada (${saved.id})`;
        },
        error: (err) => {
          this.guardando = false;
          this.error = err?.message ?? 'Error al guardar';
        },
      });
    }
  }

  private buildPayload(): {
    configs: ConfiguracionPlantilla[];
    algoritmos: AlgoritmoCombinado[];
  } {
    const configs: ConfiguracionPlantilla[] = this.configs.map((d, i) => {
      let params: Record<string, unknown> = {};
      try {
        params = d.parametrosJson ? JSON.parse(d.parametrosJson) : {};
      } catch {
        throw new Error(`JSON de par?metros inv?lido en fila ${i + 1}`);
      }
      if (d.algoritmo_codigo && !d.algoritmo_combinado_id) {
        params = { ...params, algoritmo_codigo: d.algoritmo_codigo };
      }
      return {
        id: `draft-${i}`,
        plantilla_id: this.plantillaId ?? 'draft',
        nombre_columna: d.nombre_columna,
        columna_destino: d.columna_destino || null,
        orden: Number(d.orden),
        tipo: d.tipo,
        algoritmo_combinado_id: d.algoritmo_combinado_id || null,
        configuracion: params,
        obligatoria: d.obligatoria,
      };
    });
    return { configs, algoritmos: this.algoritmos };
  }

  private toDraft(c: ConfiguracionPlantilla): ConfigDraft {
    const conf = { ...(c.configuracion ?? {}) };
    const codigo = (conf['algoritmo_codigo'] as string) ?? '';
    delete conf['algoritmo_codigo'];
    return {
      nombre_columna: c.nombre_columna,
      columna_destino: (c.columna_destino as string) ?? '',
      orden: c.orden,
      tipo: String(c.tipo),
      algoritmo_codigo: codigo,
      algoritmo_combinado_id: c.algoritmo_combinado_id ?? '',
      obligatoria: c.obligatoria,
      parametrosJson: JSON.stringify(conf),
    };
  }

  columnasDemo = COLUMNAS_ARCHIVO_DEMO;
}
