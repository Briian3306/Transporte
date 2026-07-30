import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PeajesExcelService } from '../services/peajes-excel.service';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso1-carga',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paso1-carga.component.html',
  styleUrl: './paso1-carga.component.css',
})
export class Paso1CargaComponent {
  @Output() completado = new EventEmitter<void>();

  private readonly excel = inject(PeajesExcelService);
  readonly state = inject(PeajesWizardStateService);

  error: string | null = null;
  cargando = false;
  dragOver = false;

  get meta() {
    return this.state.snapshot().preview;
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

  async procesar(file: File): Promise<void> {
    this.error = null;
    if (!this.excel.esXlsxValido(file)) {
      this.error = 'Solo se permiten archivos .xlsx';
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
    if (this.meta) {
      this.completado.emit();
    }
  }
}
