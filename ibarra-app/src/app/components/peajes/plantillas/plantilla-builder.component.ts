import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlgoritmoCombinado,
  ConfiguracionPlantilla,
  PlantillaConfiguracion,
} from '../models/peajes.models';
import { EstadoRecursoPeaje, PASADA_COLUMN_KEYS } from '../models/peajes.types';
import { PeajesMotorTransformacionService } from './motor/peajes-motor-transformacion.service';
import {
  COLUMNAS_ARCHIVO_DEMO,
  FILA_EJEMPLO_PRD_21,
  PeajesPlantillasMockService,
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
 * Persistencia vía mock hasta F01-3/F01-7.
 */
@Component({
  selector: 'app-plantilla-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plantilla-builder.component.html',
  styleUrl: './plantillas-shared.css',
})
export class PlantillaBuilderComponent implements OnInit {
  private readonly plantillasSvc = inject(PeajesPlantillasMockService);
  private readonly motor = inject(PeajesMotorTransformacionService);

  plantillaId: string | null = null;
  nombre = '';
  descripcion = '';
  empresaId = 'empresa-demo';
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

  ngOnInit(): void {
    this.codigosDisponibles = this.motor.getRegistry().codigos();
    this.plantillasSvc.listarAlgoritmos().subscribe((a) => (this.algoritmos = a));

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

  /** Carga demo §21 para edición rápida. */
  cargarDemo(): void {
    this.plantillasSvc.obtenerPlantilla('plt-demo-pasadas').subscribe((p) => {
      if (p) {
        this.plantillaId = p.id;
        this.aplicarPlantilla(p);
        this.mensaje = 'Plantilla demo §21 cargada';
      }
    });
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
      this.mensaje = 'Preview generado con fila §21';
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
      this.error = e instanceof Error ? e.message : 'Definición inválida';
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
      this.error = 'No se puede guardar: hay errores de validación';
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
      // F03-3: sobrescritura controlada en una sola operación
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
                    'Plantilla actualizada: configuraciones sobrescritas en una operación';
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
        throw new Error(`JSON de parámetros inválido en fila ${i + 1}`);
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
