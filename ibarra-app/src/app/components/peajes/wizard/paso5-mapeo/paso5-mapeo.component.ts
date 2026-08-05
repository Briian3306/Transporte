import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MapeoColumna,
  PEAJES_CATALOGO_SERVICE,
  PASADA_COLUMNAS_OBLIGATORIAS,
  PASADA_COLUMN_KEYS,
  PasadaColumnKey,
  PeajesCatalogoService,
} from '../../models';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { firstValueFrom } from 'rxjs';
import { DataTableComponent } from '../../../shared/data-table/data-table.component';
import { DataTableColumnDirective } from '../../../shared/data-table/data-table-column.directive';
import { DataTableColumn } from '../../../shared/data-table/data-table.types';

@Component({
  selector: 'app-paso5-mapeo',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DataTableColumnDirective],
  templateUrl: './paso5-mapeo.component.html',
  styleUrl: './paso5-mapeo.component.css',
})
export class Paso5MapeoComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);
  readonly destinos = PASADA_COLUMN_KEYS;
  readonly obligatorias = PASADA_COLUMNAS_OBLIGATORIAS;

  error: string | null = null;
  seleccionada: string | null = null;
  resolviendoPatentes = false;
  accionPatente: string | null = null;
  /** Bulk Agregar todas en curso (F02-16). */
  agregandoTodas = false;

  /** Mapa normalizado → id de catálogo. */
  private catalogoPatentes = new Map<string, string>();
  /** Patentes del archivo aún no en catálogo ni excluidas. */
  unresolvedPatentes: string[] = [];
  filtroPatenteRapido = '';

  readonly unresolvedColumns: DataTableColumn[] = [
    { key: 'PATENTE', label: 'PATENTE' },
    { key: 'acciones', label: 'Acciones', templateOnly: true, width: '12rem', align: 'right' },
  ];

  constructor(@Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService) {}

  async ngOnInit(): Promise<void> {
    this.state.asegurarMapeosObligatorios();
    await this.cargarCatalogoPatentes();
    this.recomputarUnresolved();
  }

  get mapeos(): MapeoColumna[] {
    return this.state.mapeosActivos();
  }

  get mapeoSeleccionado(): MapeoColumna | null {
    if (!this.seleccionada) {
      return this.mapeos[0] ?? null;
    }
    return this.mapeos.find((m) => m.columnaOrigen === this.seleccionada) ?? this.mapeos[0] ?? null;
  }

  /** Patentes unresolved respetando el filtro rápido (fuente de bulk actions). */
  patentesVisibles(): string[] {
    const q = this.filtroPatenteRapido.trim().toUpperCase();
    return q
      ? this.unresolvedPatentes.filter((p) => p.includes(q))
      : [...this.unresolvedPatentes];
  }

  get unresolvedRows(): Record<string, unknown>[] {
    return this.patentesVisibles().map((PATENTE) => ({ id: PATENTE, PATENTE }));
  }

  get puedeContinuar(): boolean {
    return (
      !this.faltantes().length &&
      this.unresolvedPatentes.length === 0 &&
      !this.resolviendoPatentes &&
      !this.agregandoTodas
    );
  }

  get accionesPatenteOcupadas(): boolean {
    return this.agregandoTodas || !!this.accionPatente;
  }

  etiquetaOrigen(col: string): string {
    // RN-07: QUANTITY sintético (ASIGNAR_VALOR) — priorizar "valor generado" sobre "(pipeline)".
    if (col === 'QUANTITY' && !this.origenEnArchivo(col)) {
      return 'QUANTITY (valor generado)';
    }
    if (this.esSalidaPipeline(col)) {
      return `${col} (pipeline)`;
    }
    return col;
  }

  esSalidaPipeline(col: string): boolean {
    return this.state.columnasGeneradasPipeline().includes(col);
  }

  /** Origen sintético / no presente como columna del Excel. */
  private origenEnArchivo(col: string): boolean {
    const cols = this.state.snapshot().preview?.columnas ?? this.state.columnasParaMapeo();
    return cols.some((c) => c.trim().toUpperCase() === col.toUpperCase());
  }

  descripcionTransform(m: MapeoColumna): string {
    const dest = m.columnaDestino;
    if (this.esSalidaPipeline(m.columnaOrigen)) {
      return dest
        ? `Salida del pipeline → ${dest}`
        : 'Salida del pipeline (elegí destino estándar)';
    }
    const map: Record<string, string> = {
      FECHA_HORA: 'Completar HORA · combinar columnas',
      PASE_ID: 'Convertir a texto · limpiar',
      PATENTE_ID: 'Eliminar guiones · mayúsculas',
      ESTACION_ID: 'Buscar catálogo interno',
      PRECIO: 'Número decimal',
      BONIFICACION: 'Número decimal',
      QUANTITY: 'Asignar 1',
      IMPORTE_NETO: 'Calcular diferencia',
    };
    if (dest && map[dest]) {
      return map[dest];
    }
    return dest ? 'Mapear columna' : 'Sin transformación';
  }

  setDestino(columnaOrigen: string, destino: string): void {
    const all = this.state.snapshot().mapeos.map((m) => {
      if (m.columnaOrigen !== columnaOrigen) {
        return { ...m };
      }
      return {
        ...m,
        columnaDestino: destino ? (destino as PasadaColumnKey) : null,
      };
    });
    this.state.setMapeos(all);
    this.error = null;
    this.recomputarUnresolved();
  }

  destinoUsado(key: PasadaColumnKey, exceptoOrigen: string): boolean {
    return this.mapeos.some(
      (m) => m.columnaDestino === key && m.columnaOrigen !== exceptoOrigen
    );
  }

  faltantes(): PasadaColumnKey[] {
    const mapeados = new Set(
      this.mapeos.filter((m) => m.columnaDestino).map((m) => m.columnaDestino!)
    );
    return this.obligatorias.filter((k) => !mapeados.has(k) && k !== 'IMPORTE_NETO');
  }

  async agregarPatente(patente: string): Promise<void> {
    this.accionPatente = patente;
    this.error = null;
    try {
      await this.crearPatenteEnCatalogo(patente);
      this.recomputarUnresolved();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo crear la patente.';
    } finally {
      this.accionPatente = null;
    }
  }

  quitarPatente(patente: string): void {
    this.state.excluirPatenteDelImport(this.normalizarPatente(patente));
    this.recomputarUnresolved();
    this.error = null;
  }

  /** Alta masiva de las patentes visibles (filtro rápido) — F02-16. */
  async agregarTodasPatentes(): Promise<void> {
    const pendientes = this.patentesVisibles();
    if (!pendientes.length || this.agregandoTodas) {
      return;
    }
    this.agregandoTodas = true;
    this.error = null;
    let ok = 0;
    const fallos: string[] = [];
    try {
      for (const patente of pendientes) {
        this.accionPatente = patente;
        try {
          await this.crearPatenteEnCatalogo(patente);
          ok += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'error';
          fallos.push(`${patente}: ${msg}`);
        }
      }
      this.recomputarUnresolved();
      if (fallos.length) {
        this.error = `Agregadas ${ok}/${pendientes.length}. Fallaron: ${fallos.slice(0, 3).join('; ')}${
          fallos.length > 3 ? ` (+${fallos.length - 3} más)` : ''
        }`;
      }
    } finally {
      this.accionPatente = null;
      this.agregandoTodas = false;
    }
  }

  /** Excluye del import las patentes visibles (filtro rápido) — F02-16. */
  quitarTodasPatentes(): void {
    if (this.accionesPatenteOcupadas) {
      return;
    }
    for (const patente of this.patentesVisibles()) {
      this.state.excluirPatenteDelImport(this.normalizarPatente(patente));
    }
    this.recomputarUnresolved();
    this.error = null;
  }

  private async crearPatenteEnCatalogo(patente: string): Promise<void> {
    const creada = await firstValueFrom(
      this.catalogo.crearPatente({
        patente: patente.toUpperCase(),
        categoria: 'TRANSPORTE',
      })
    );
    this.catalogoPatentes.set(this.normalizarPatente(creada.patente), creada.id);
    this.catalogoPatentes.set(creada.id, creada.id);
  }

  asPatente(row: Record<string, unknown>): string {
    return String(row['PATENTE'] ?? '');
  }

  async continuar(): Promise<void> {
    const faltan = this.faltantes();
    if (faltan.length) {
      this.error = `Columnas obligatorias sin mapear: ${faltan.join(', ')}`;
      return;
    }
    this.recomputarUnresolved();
    if (this.unresolvedPatentes.length) {
      this.error = `Resolvé las patentes pendientes (${this.unresolvedPatentes.length}) antes de continuar.`;
      return;
    }
    this.resolviendoPatentes = true;
    try {
      await this.cargarCatalogoPatentes();
      const pasadas = this.state.construirPasadasDesdeMapeo();
      for (const pasada of pasadas) {
        const clave = this.normalizarPatente(pasada.PATENTE_ID);
        const patenteId = this.catalogoPatentes.get(clave);
        if (!patenteId) {
          this.error = `Patente sin resolver tras filtrar exclusiones: ${clave || '(vacía)'}`;
          return;
        }
        pasada.PATENTE_ID = patenteId;
      }
      this.state.setPasadasEstandarizadas(pasadas);
      this.completado.emit();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo consultar el catálogo de patentes.';
    } finally {
      this.resolviendoPatentes = false;
    }
  }

  private async cargarCatalogoPatentes(): Promise<void> {
    const patentes = await firstValueFrom(this.catalogo.listarPatentes());
    this.catalogoPatentes = new Map<string, string>();
    for (const patente of patentes) {
      this.catalogoPatentes.set(this.normalizarPatente(patente.patente), patente.id);
      this.catalogoPatentes.set(patente.id, patente.id);
    }
  }

  private recomputarUnresolved(): void {
    if (this.faltantes().length) {
      this.unresolvedPatentes = [];
      return;
    }
    const excluidas = new Set(this.state.snapshot().patentesExcluidas);
    const pasadas = this.state.construirPasadasDesdeMapeo();
    const missing = new Set<string>();
    for (const pasada of pasadas) {
      const clave = this.normalizarPatente(pasada.PATENTE_ID);
      if (!clave || excluidas.has(clave)) continue;
      if (!this.catalogoPatentes.has(clave)) {
        missing.add(clave);
      }
    }
    this.unresolvedPatentes = [...missing].sort();
  }

  private normalizarPatente(valor: unknown): string {
    return String(valor ?? '').replace(/[\s-]/g, '').toUpperCase();
  }
}
