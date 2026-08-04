import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Inject } from '@angular/core';
import { Empresa, PEAJES_CATALOGO_SERVICE, PEAJES_PLANTILLAS_SERVICE, PeajesCatalogoService, PlantillaConfiguracion, PeajesPlantillasService } from '../../models';
import { DialogComponent } from '../../../shared';
import { MVP_EJEMPLO_NOMBRE_ARCHIVO } from '../fixtures/mvp-ejemplo.fixture';
import { PeajesExcelService } from '../services/peajes-excel.service';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso1-carga',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent],
  templateUrl: './paso1-carga.component.html',
  styleUrl: './paso1-carga.component.css',
})
export class Paso1CargaComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();

  private readonly excel = inject(PeajesExcelService);
  readonly state = inject(PeajesWizardStateService);
  plantillas: PlantillaConfiguracion[] = [];
  empresas: Empresa[] = [];
  plantillaId = '';
  empresaId = '';
  crearEmpresaAbierto = false;
  nuevaEmpresaNombre = '';
  nuevaEmpresaDescripcion = '';

  error: string | null = null;
  cargando = false;
  dragOver = false;

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService,
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  async ngOnInit(): Promise<void> {
    this.plantillaId = this.state.snapshot().plantillaId ?? '';
    this.empresaId = this.state.snapshot().empresaId ?? '';
    this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
    await this.cargarPlantillas();
  }

  seleccionarPlantilla(): void {
    this.state.setPlantillaId(this.plantillaId || null);
  }
  async seleccionarEmpresa(): Promise<void> {
    this.state.setEmpresaId(this.empresaId || null); this.plantillaId = ''; this.state.setPlantillaId(null); await this.cargarPlantillas();
  }
  async crearEmpresa(): Promise<void> {
    if (!this.nuevaEmpresaNombre.trim()) return;
    const empresa = await firstValueFrom(this.catalogo.crearEmpresa({ nombre: this.nuevaEmpresaNombre.trim(), descripcion: this.nuevaEmpresaDescripcion.trim() || null }));
    this.empresas = [...this.empresas, empresa]; this.empresaId = empresa.id; this.crearEmpresaAbierto = false; await this.seleccionarEmpresa();
  }
  private async cargarPlantillas(): Promise<void> { this.plantillas = await firstValueFrom(this.plantillasSvc.listarPlantillas(this.empresaId || undefined)); }

  get meta() {
    return this.state.snapshot().preview;
  }

  get esEjemploMvp(): boolean {
    return this.meta?.nombreArchivo === MVP_EJEMPLO_NOMBRE_ARCHIVO;
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
    this.state.cargarEjemploMvp();
  }

  async procesar(file: File): Promise<void> {
    this.error = null;
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

  continuar(): void {
    if (this.meta && this.empresaId) {
      this.completado.emit();
    }
  }
}
