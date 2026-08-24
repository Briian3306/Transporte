import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { PdfAmountCandidate, PdfAmountKind, PdfReaderAnalysis, PdfReaderAnalysisService } from './pdf-reader-analysis.service';

@Component({
  selector: 'app-pdf-reader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf-reader.component.html',
  styleUrl: './pdf-reader.component.css',
})
export class PdfReaderComponent {
  private readonly analysisService = inject(PdfReaderAnalysisService);

  readonly amountKinds: PdfAmountKind[] = ['subtotal', 'iva', 'total'];
  archivoSeleccionado: File | null = null;
  analysis: PdfReaderAnalysis | null = null;
  error = '';
  leyendo = false;

  seleccionarArchivo(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.archivoSeleccionado = file;
    this.analysis = null;
    this.error = file && file.type !== 'application/pdf' ? 'Seleccioná un archivo PDF válido.' : '';
  }

  async analizar(): Promise<void> {
    if (!this.archivoSeleccionado) {
      this.error = 'Seleccioná un archivo PDF para analizar.';
      return;
    }
    if (this.archivoSeleccionado.type !== 'application/pdf') {
      this.error = 'Seleccioná un archivo PDF válido.';
      return;
    }

    this.leyendo = true;
    this.error = '';
    this.analysis = null;
    try {
      this.analysis = await this.analysisService.analizar(this.archivoSeleccionado);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo analizar el PDF.';
    } finally {
      this.leyendo = false;
    }
  }

  candidates(kind: PdfAmountKind): PdfAmountCandidate[] {
    return this.analysis?.amounts[kind] ?? [];
  }

  uniqueCandidate(kind: PdfAmountKind): PdfAmountCandidate | null {
    const candidates = this.candidates(kind);
    return candidates.length === 1 ? candidates[0] : null;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
