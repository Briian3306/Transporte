import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Inject } from '@angular/core';
import {
  Empresa,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
  PeajesCatalogoService,
  PlantillaConfiguracion,
  PeajesPlantillasService,
} from '../../models';
import { DialogComponent, SearchSelectComponent, SearchSelectOption } from '../../../shared';
import { COLUMNA_FACTURA_MASIVA, excelTieneColumnaFactura } from '../../models';
import { MVP_EJEMPLO_NOMBRE_ARCHIVO } from '../fixtures/mvp-ejemplo.fixture';
import { PeajesExcelService } from '../services/peajes-excel.service';
import {
  PeajesPlantillaApplyService,
  PlantillaExcepcionPaso,
} from '../services/peajes-plantilla-apply.service';
import {
  ModoImportacion,
  PeajesWizardStateService,
} from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso1-carga',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent, SearchSelectComponent],
  templateUrl: './paso1-carga.component.html',
  styleUrl: './paso1-carga.component.css',
})
export class Paso1CargaComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  /** Plantilla aplicada sin excepciones → Factura. */
  @Output() facturaDirecta = new EventEmitter<void>();
  /** Excepciones tras aplicar plantilla → Paso 5 o 6. */
  @Output() irAExcepcion = new EventEmitter<PlantillaExcepcionPaso>();

  private readonly excel = inject(PeajesExcelService);
  private readonly plantillaApply = inject(PeajesPlantillaApplyService);
  readonly state = inject(PeajesWizardStateService);
  plantillas: PlantillaConfiguracion[] = [];
  empresas: Empresa[] = [];
  plantillaId = '';
  /**
   * Empresa of this load (simple mode). Paso 6 recognizes estaciones only
   * inside this company's peajes. Required in simple Telepase CSV because
   * provider code `0001` is Zarate (MERCOSUR) and DOCK SUD (AUBASA).
   */
  empresaId = '';
  modoImportacion: ModoImportacion = 'simple';
  crearEmpresaAbierto = false;
  nuevaEmpresaNombre = '';
  nuevaEmpresaDescripcion = '';

  error: string | null = null;
  info: string | null = null;
  erroresPlantilla: string[] = [];
  cargando = false;
  aplicandoPlantilla = false;
  dragOver = false;

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService,
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  async ngOnInit(): Promise<void> {
    const snap = this.state.snapshot();
    this.plantillaId = snap.plantillaId ?? '';
    this.empresaId = snap.empresaId ?? '';
    this.modoImportacion = snap.modoImportacion ?? 'simple';
    this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
    await this.cargarPlantillas();
  }

  onModoImportacionChange(modo: ModoImportacion): void {
    this.modoImportacion = modo;
    this.state.setModoImportacion(modo);
    this.error = null;
    if (modo === 'masiva' && this.meta && !excelTieneColumnaFactura(this.meta.columnas)) {
      this.error =
        `La importación masiva requiere la columna exacta «${COLUMNA_FACTURA_MASIVA}» en el Excel. No se puede continuar sin ella.`;
    } else if (modo === 'masiva' && this.meta) {
      this.state.rebuildDocumentosDesdeFactura();
    }
  }

  get empresaOptions(): SearchSelectOption[] {
    return this.empresas.map((e) => ({ id: e.id, label: e.nombre }));
  }

  get plantillaOptions(): SearchSelectOption[] {
    return this.plantillas.map((p) => ({
      id: p.id,
      label: `${p.nombre} · ${p.estado}`,
    }));
  }

  onPlantillaChange(id: string | null): void {
    this.plantillaId = id ?? '';
    this.state.setPlantillaId(id);
    this.erroresPlantilla = [];
    this.info = null;
  }

  async onEmpresaChange(id: string | null): Promise<void> {
    this.empresaId = id ?? '';
    this.state.setEmpresaId(id);
    this.plantillaId = '';
    this.state.setPlantillaId(null);
    this.erroresPlantilla = [];
    this.info = null;
    await this.cargarPlantillas();
  }

  async crearEmpresa(): Promise<void> {
    if (!this.nuevaEmpresaNombre.trim()) return;
    const empresa = await firstValueFrom(
      this.catalogo.crearEmpresa({
        nombre: this.nuevaEmpresaNombre.trim(),
        descripcion: this.nuevaEmpresaDescripcion.trim() || null,
      })
    );
    this.empresas = [...this.empresas, empresa];
    this.crearEmpresaAbierto = false;
    this.nuevaEmpresaNombre = '';
    this.nuevaEmpresaDescripcion = '';
    await this.onEmpresaChange(empresa.id);
  }

  private async cargarPlantillas(): Promise<void> {
    this.plantillas = await firstValueFrom(
      this.plantillasSvc.listarPlantillas(this.empresaId || undefined)
    );
  }

  get meta() {
    return this.state.snapshot().preview;
  }

  get esEjemploMvp(): boolean {
    return this.meta?.nombreArchivo === MVP_EJEMPLO_NOMBRE_ARCHIVO;
  }

  get puedeContinuar(): boolean {
    // Masiva: empresa se asigna por documento en Paso 7 (archivo multi-empresa).
    const empresaOk = this.modoImportacion === 'masiva' || !!this.empresaId;
    return !!this.meta && empresaOk && !this.cargando && !this.aplicandoPlantilla;
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void this.procesar(file);
    }
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.procesar(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  cargarEjemploMvp(): void {
    this.error = null;
    this.erroresPlantilla = [];
    this.info = null;
    this.state.cargarEjemploMvp();
  }

  async procesar(file: File): Promise<void> {
    this.error = null;
    this.erroresPlantilla = [];
    this.info = null;
    if (!this.excel.esArchivoValido(file)) {
      this.error = 'Solo se permiten archivos .xlsx o .csv';
      return;
    }

    this.cargando = true;
    try {
      const preview = await this.excel.parsearArchivo(file);
      this.state.setPreview(preview);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo procesar el archivo';
    } finally {
      this.cargando = false;
    }
  }

  async continuar(): Promise<void> {
    if (!this.meta) {
      this.error = 'Seleccioná un archivo para continuar.';
      return;
    }
    if (this.modoImportacion !== 'masiva' && !this.empresaId) {
      this.error = 'Seleccioná un archivo y una empresa para continuar.';
      return;
    }
    if (this.modoImportacion === 'masiva' && !excelTieneColumnaFactura(this.meta.columnas)) {
      this.error =
        `Importación masiva bloqueada: el archivo no tiene la columna «${COLUMNA_FACTURA_MASIVA}». ` +
        'Usá importación simple o cargá un Excel con esa columna.';
      return;
    }
    this.error = null;
    this.erroresPlantilla = [];
    this.info = null;
    this.state.setModoImportacion(this.modoImportacion);
    if (this.modoImportacion === 'masiva') {
      this.state.rebuildDocumentosDesdeFactura();
    }

    // Sin plantilla: flujo guiado desde preview (Paso 2).
    if (!this.plantillaId) {
      this.completado.emit();
      return;
    }

    this.aplicandoPlantilla = true;
    try {
      this.state.setPlantillaId(this.plantillaId);
      const result = await this.plantillaApply.aplicarYEvaluar(this.plantillaId);
      this.info = result.mensaje;
      if (!result.ok) {
        this.erroresPlantilla = result.errores;
        this.error = result.mensaje;
        return;
      }
      if (result.excepcion === null) {
        this.facturaDirecta.emit();
        return;
      }
      this.irAExcepcion.emit(result.excepcion);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo aplicar la plantilla.';
    } finally {
      this.aplicandoPlantilla = false;
    }
  }
}
