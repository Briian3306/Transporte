import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AlgoritmoCombinado,
  AlgoritmoCombinadoPaso,
  ConfiguracionPlantilla,
  Empresa,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
  PeajesCatalogoService,
  PeajesPlantillasService,
} from '../models';
import { EstadoRecursoPeaje } from '../models/peajes.types';
import { PeajesMotorTransformacionService } from './motor/peajes-motor-transformacion.service';
import { PEAJES_GLOBAL_EMPRESA_ID } from '../services';
import { validarPublicacionAlgoritmo } from './validacion/plantillas-validacion';
import { PasoEjecucion } from './motor/strategy.types';
import { FILA_EJEMPLO_PRD_21 } from './mocks/peajes-plantillas.mock';

const GLOBAL_EMPRESA_ID = PEAJES_GLOBAL_EMPRESA_ID;

/** Códigos atómicos que suelen usar solo `columna` como parámetro guiado. */
const CODIGOS_COLUMNA_SIMPLE = new Set([
  'BORRAR_ESPACIOS',
  'ELIMINAR_GUIONES',
  'CONVERTIR_MAYUSCULAS',
  'REEMPLAZAR_TEXTO',
  'CONVERTIR_TEXTO',
  'CONVERTIR_NUMERO',
  'CONVERTIR_NUMERO_ARS',
  'COPIAR_COLUMNA',
]);

interface PasoDraft {
  orden: number;
  algoritmo_codigo: string;
  /** Columna guiada (sincronizada con JSON avanzado). */
  columna: string;
  parametrosJson: string;
  mostrarAvanzado: boolean;
}

/**
 * Builder de algoritmos combinados (F03-5, F03-6).
 * Preview con filas de muestra (mismo enfoque que Paso 3).
 */
@Component({
  selector: 'app-algoritmo-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './algoritmo-builder.component.html',
  styleUrl: './plantillas-shared.css',
})
export class AlgoritmoBuilderComponent implements OnInit {
  private readonly motor = inject(PeajesMotorTransformacionService);

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService,
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  algoritmos: AlgoritmoCombinado[] = [];
  empresas: Empresa[] = [];
  algoritmoId: string | null = null;
  nombre = '';
  descripcion = '';
  empresaId = '';
  esGlobal = false;
  estado: EstadoRecursoPeaje = 'borrador';
  pasos: PasoDraft[] = [];
  codigosDisponibles: string[] = [];

  /** Vínculo de plantilla al previsualizar / guardar ejemplo. */
  columnaOrigen = 'DOMINIO';
  columnaDestino = 'PATENTE_ID';

  pasosEfectivos: PasoEjecucion[] = [];
  filasMuestra: Record<string, unknown>[] = [];
  filasPreviewIo: Record<string, unknown>[] = [];
  columnasPreview: string[] = [];
  previewLoading = false;

  mensaje: string | null = null;
  error: string | null = null;
  errores: string[] = [];
  guardando = false;

  ngOnInit(): void {
    this.codigosDisponibles = this.motor.getRegistry().codigos();
    this.filasMuestra = this.buildFilasMuestra();
    void this.cargarEmpresas();
    this.recargarLista();
    this.agregarPaso();
  }

  private buildFilasMuestra(): Record<string, unknown>[] {
    return [
      { ...FILA_EJEMPLO_PRD_21, DOMINIO: ' ad-625-qb ', PATENTE: ' ad-625-qb ' },
      { ...FILA_EJEMPLO_PRD_21, DOMINIO: 'AB123CD', PATENTE: 'AB123CD' },
      { ...FILA_EJEMPLO_PRD_21, DOMINIO: ' xy-999-zz ', PATENTE: ' xy-999-zz ' },
    ];
  }

  async cargarEmpresas(): Promise<void> {
    this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
    if (!this.empresaId && this.empresas.length) {
      this.empresaId = this.empresas[0].id;
    }
  }

  recargarLista(): void {
    this.plantillasSvc.listarAlgoritmos().subscribe((list) => (this.algoritmos = list));
  }

  nuevo(): void {
    this.algoritmoId = null;
    this.nombre = '';
    this.descripcion = '';
    this.esGlobal = false;
    this.estado = 'borrador';
    this.pasos = [];
    this.pasosEfectivos = [];
    this.filasPreviewIo = [];
    this.mensaje = null;
    this.error = null;
    this.errores = [];
    this.agregarPaso();
  }

  seleccionar(id: string): void {
    this.plantillasSvc.listarAlgoritmos().subscribe((list) => {
      const alg = list.find((a) => a.id === id);
      if (!alg) return;
      this.algoritmoId = alg.id;
      this.nombre = alg.nombre;
      this.descripcion = alg.descripcion ?? '';
      this.empresaId = alg.empresa_id === GLOBAL_EMPRESA_ID ? this.empresaId : alg.empresa_id;
      this.esGlobal = alg.empresa_id === GLOBAL_EMPRESA_ID;
      this.estado = alg.estado;
      this.pasos = (alg.pasos ?? []).map((p) => this.pasoDesdePersistido(p));
      this.expandir();
      this.actualizarPreview();
    });
  }

  /** Carga el ejemplo PATENTE (NORMALIZAR_PATENTE → PATENTE_ID). UPPER = CONVERTIR_MAYUSCULAS. */
  cargarEjemploPatente(): void {
    this.algoritmoId = null;
    this.nombre = 'NORMALIZAR_PATENTE';
    this.descripcion =
      'Ejemplo PATENTE: BORRAR_ESPACIOS + ELIMINAR_GUIONES + CONVERTIR_MAYUSCULAS (UPPER). Destino plantilla: PATENTE_ID.';
    this.estado = 'activa';
    this.columnaOrigen = 'DOMINIO';
    this.columnaDestino = 'PATENTE_ID';
    this.pasos = [
      this.crearPaso(10, 'BORRAR_ESPACIOS', 'DOMINIO'),
      this.crearPaso(20, 'ELIMINAR_GUIONES', 'PATENTE_ID'),
      this.crearPaso(30, 'CONVERTIR_MAYUSCULAS', 'PATENTE_ID'),
    ];
    this.mensaje =
      'Ejemplo PATENTE cargado. Previsualizá el efecto y guardá; en la plantilla vinculá columna_destino = PATENTE_ID.';
    this.error = null;
    this.expandir();
    this.actualizarPreview();
  }

  /** Ejemplo seguro para aliases antes del reconocedor de estaciones. */
  cargarEjemploReemplazoEstacion(): void {
    this.algoritmoId = null;
    this.nombre = 'NORMALIZAR_ESTACION_AUSOL';
    this.descripcion = 'Ejemplo AUSOL: aliases declarativos antes de resolver ESTACION_ID.';
    this.estado = 'activa';
    this.columnaOrigen = 'ESTACION';
    this.columnaDestino = 'ESTACION_NORMALIZADA';
    this.pasos = [{
      orden: 10,
      algoritmo_codigo: 'REEMPLAZAR_TEXTO',
      columna: 'ESTACION',
      parametrosJson: JSON.stringify({
        columna: 'ESTACION',
        reglas: [{ buscar: 'BD', reemplazar: 'BLACK DECK' }],
      }),
      mostrarAvanzado: true,
    }];
    this.mensaje = 'Ejemplo AUSOL cargado. Las reglas se aplican antes del reconocedor de estaciones.';
    this.error = null;
    this.expandir();
    this.actualizarPreview();
  }

  private crearPaso(orden: number, codigo: string, columna: string): PasoDraft {
    return {
      orden,
      algoritmo_codigo: codigo,
      columna,
      parametrosJson: JSON.stringify({ columna }),
      mostrarAvanzado: false,
    };
  }

  private pasoDesdePersistido(p: AlgoritmoCombinadoPaso): PasoDraft {
    const params = (p.parametros ?? {}) as Record<string, unknown>;
    const columna = typeof params['columna'] === 'string' ? params['columna'] : '';
    return {
      orden: p.orden,
      algoritmo_codigo: p.algoritmo_codigo,
      columna,
      parametrosJson: JSON.stringify(params),
      mostrarAvanzado: false,
    };
  }

  agregarPaso(): void {
    const next = this.pasos.reduce((m, p) => Math.max(m, p.orden), 0) + 10;
    this.pasos.push({
      orden: next || 10,
      algoritmo_codigo: '',
      columna: '',
      parametrosJson: '{}',
      mostrarAvanzado: false,
    });
  }

  quitarPaso(i: number): void {
    this.pasos.splice(i, 1);
    this.actualizarPreview();
  }

  usaColumnaSimple(codigo: string): boolean {
    return CODIGOS_COLUMNA_SIMPLE.has(codigo);
  }

  onCodigoChange(p: PasoDraft): void {
    if (this.usaColumnaSimple(p.algoritmo_codigo) && p.columna) {
      this.syncColumnaToJson(p);
    }
    this.actualizarPreview();
  }

  onColumnaChange(p: PasoDraft): void {
    this.syncColumnaToJson(p);
    this.actualizarPreview();
  }

  private syncColumnaToJson(p: PasoDraft): void {
    let base: Record<string, unknown> = {};
    try {
      base = p.parametrosJson ? JSON.parse(p.parametrosJson) : {};
    } catch {
      base = {};
    }
    if (p.columna) {
      base['columna'] = p.columna;
    } else {
      delete base['columna'];
    }
    p.parametrosJson = JSON.stringify(base);
  }

  expandir(): void {
    this.error = null;
    this.pasosEfectivos = [];
    try {
      const alg = this.comoAlgoritmoTemporal();
      this.pasosEfectivos = this.motor.expandirAlgoritmo(alg);
      this.mensaje = `Pasos efectivos: ${this.pasosEfectivos.map((p) => p.algoritmoCodigo).join(' → ')}`;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al expandir';
    }
  }

  actualizarPreview(): void {
    this.previewLoading = true;
    this.error = null;
    try {
      const alg = this.comoAlgoritmoTemporal();
      if (!alg.pasos?.length || alg.pasos.some((p) => !p.algoritmo_codigo)) {
        this.filasPreviewIo = [];
        this.columnasPreview = [];
        return;
      }
      const config = this.buildConfigPreview(alg.id);
      const filasBase = this.filasMuestra.map((f) => ({ ...f }));
      const transformadas = this.motor.aplicarPipeline(filasBase, [config], [alg]);
      this.filasPreviewIo = filasBase.map((orig, i) => {
        const out = transformadas[i] ?? {};
        return {
          ...Object.fromEntries(
            Object.entries(orig).map(([k, v]) => [`origen.${k}`, v])
          ),
          ...Object.fromEntries(
            Object.entries(out).map(([k, v]) => [`salida.${k}`, v])
          ),
        };
      });
      const keys = new Set<string>();
      for (const row of this.filasPreviewIo) {
        Object.keys(row).forEach((k) => keys.add(k));
      }
      this.columnasPreview = [...keys].sort((a, b) => {
        const ao = a.startsWith('origen.') ? 0 : 1;
        const bo = b.startsWith('origen.') ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return a.localeCompare(b);
      });
      this.pasosEfectivos = this.motor.expandirAlgoritmo(alg);
    } catch (e) {
      this.filasPreviewIo = [];
      this.columnasPreview = [];
      this.error = e instanceof Error ? e.message : 'Error en preview';
    } finally {
      this.previewLoading = false;
    }
  }

  private buildConfigPreview(algoritmoId: string): ConfiguracionPlantilla {
    return {
      id: 'cfg-preview-alg',
      plantilla_id: 'plt-preview',
      nombre_columna: this.columnaOrigen || 'DOMINIO',
      columna_destino: this.columnaDestino || 'PATENTE_ID',
      orden: 10,
      tipo: 'transformacion',
      algoritmo_combinado_id: algoritmoId,
      configuracion: {},
      obligatoria: true,
    };
  }

  async guardar(): Promise<void> {
    this.error = null;
    this.mensaje = null;
    this.errores = [];

    let pasosOmit: Omit<AlgoritmoCombinadoPaso, 'id' | 'algoritmo_combinado_id'>[];
    try {
      pasosOmit = this.pasos.map((p, i) => {
        if (!p.algoritmo_codigo) {
          throw new Error(`Paso ${i + 1} sin algoritmo_codigo`);
        }
        if (!this.motor.getRegistry().tiene(p.algoritmo_codigo)) {
          throw new Error(
            `No se permite referenciar códigos no registrados: ${p.algoritmo_codigo}`
          );
        }
        this.syncColumnaToJson(p);
        let parametros: Record<string, unknown> | null = null;
        try {
          parametros = p.parametrosJson ? JSON.parse(p.parametrosJson) : null;
        } catch {
          throw new Error(`JSON inválido en paso ${i + 1}`);
        }
        return {
          orden: Number(p.orden),
          algoritmo_codigo: p.algoritmo_codigo,
          parametros,
        };
      });
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Definición inválida';
      return;
    }

    if (!this.esGlobal && !this.empresaId) {
      this.error = 'Seleccioná una empresa o marcá el recurso como global.';
      return;
    }

    const empresa = this.esGlobal ? GLOBAL_EMPRESA_ID : this.empresaId;
    const validacion = validarPublicacionAlgoritmo(
      { nombre: this.nombre, empresa_id: empresa },
      pasosOmit,
      this.motor.getRegistry()
    );
    if (!validacion.ok) {
      this.errores = validacion.errores.map((e) => e.motivo);
      this.error = 'Publicación bloqueada por validación';
      return;
    }

    this.guardando = true;
    try {
      const saved = await firstValueFrom(
        this.plantillasSvc.guardarAlgoritmo(
          {
            id: this.algoritmoId ?? undefined,
            nombre: this.nombre,
            descripcion: this.descripcion || null,
            empresa_id: empresa,
            estado: this.estado,
          },
          pasosOmit
        )
      );
      this.algoritmoId = saved.id;
      this.mensaje = `Algoritmo guardado (${saved.nombre}). En plantillas, vinculá columna_destino = ${this.columnaDestino || 'PATENTE_ID'}.`;
      this.recargarLista();
      this.expandir();
      this.actualizarPreview();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al guardar';
    } finally {
      this.guardando = false;
    }
  }

  /**
   * Guarda el algoritmo y crea/actualiza una plantilla mínima que escribe en PATENTE_ID.
   */
  async guardarConPlantillaPatente(): Promise<void> {
    await this.guardar();
    if (!this.algoritmoId || this.error) {
      return;
    }
    const empresa = this.esGlobal ? GLOBAL_EMPRESA_ID : this.empresaId;
    const destino = this.columnaDestino || 'PATENTE_ID';
    const origen = this.columnaOrigen || 'DOMINIO';
    const nombrePlantilla = `Ejemplo ${this.nombre || 'PATENTE'} → ${destino}`;

    this.guardando = true;
    try {
      const existentes = await firstValueFrom(this.plantillasSvc.listarPlantillas(empresa));
      const prev = existentes.find((p) => p.nombre === nombrePlantilla);
      const saved = await firstValueFrom(
        this.plantillasSvc.guardarPlantilla(
          {
            id: prev?.id,
            nombre: nombrePlantilla,
            descripcion: `Plantilla de ejemplo: ${origen} → ${destino} vía ${this.nombre}.`,
            empresa_id: empresa,
            estrategia_codigo: 'EJEMPLO_PATENTE',
            estado: 'activa',
          },
          [
            {
              nombre_columna: origen,
              columna_destino: destino,
              orden: 10,
              tipo: 'transformacion',
              algoritmo_combinado_id: this.algoritmoId,
              configuracion: {},
              obligatoria: true,
            },
          ]
        )
      );
      this.mensaje = `Algoritmo y plantilla guardados. Plantilla «${saved.nombre}» escribe en ${destino} (como el mapeo de Paso 5).`;
    } catch (err) {
      this.error =
        err instanceof Error
          ? err.message
          : 'Algoritmo guardado, pero falló la plantilla de ejemplo';
    } finally {
      this.guardando = false;
    }
  }

  private comoAlgoritmoTemporal(): AlgoritmoCombinado {
    return {
      id: this.algoritmoId ?? 'tmp-alg-preview',
      nombre: this.nombre || 'tmp',
      empresa_id: this.esGlobal ? GLOBAL_EMPRESA_ID : this.empresaId || 'tmp',
      estado: this.estado,
      pasos: this.pasos.map((p, i) => {
        this.syncColumnaToJson(p);
        let parametros: Record<string, unknown> | null = null;
        try {
          parametros = p.parametrosJson ? JSON.parse(p.parametrosJson) : null;
        } catch {
          parametros = null;
        }
        return {
          id: `tmp-${i}`,
          algoritmo_combinado_id: this.algoritmoId ?? 'tmp-alg-preview',
          orden: Number(p.orden),
          algoritmo_codigo: p.algoritmo_codigo,
          parametros,
        };
      }),
    };
  }
}
