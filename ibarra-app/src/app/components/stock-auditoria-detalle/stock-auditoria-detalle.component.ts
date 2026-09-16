import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StockAuditoriasService } from '../../services/stock-auditorias.service';
import { StockPdfService } from '../../services/stock-pdf.service';
import { StockService } from '../../services/stock.service';
import {
  AuditoriaStock,
  AuditoriaStockItem,
  EstadoItemAuditoria,
  ResumenDesviosAuditoria,
  StockDeposito,
} from '../../models/stock.model';

interface BorradorItem {
  estado_item: EstadoItemAuditoria;
  cantidad_contada: number | null;
  motivo: string;
  observaciones: string;
}

@Component({
  selector: 'app-stock-auditoria-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-auditoria-detalle.component.html',
  styleUrl: './stock-auditoria-detalle.component.css'
})
export class StockAuditoriaDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auditoriasService = inject(StockAuditoriasService);
  private stockService = inject(StockService);
  private pdfService = inject(StockPdfService);

  auditoria: AuditoriaStock | null = null;
  resumen: ResumenDesviosAuditoria | null = null;
  borradores: Record<string, BorradorItem> = {};
  soloPendientes = false;
  aplicarAjustes = false;
  loading = true;
  guardando = false;
  error: string | null = null;
  mostrarAgregar = false;
  stockDisponible: StockDeposito[] = [];
  seleccionAgregar = new Set<string>();

  estados: { value: EstadoItemAuditoria; label: string }[] = [
    { value: 'ok', label: 'OK' },
    { value: 'con_desvio', label: 'Con desvío' },
    { value: 'no_encontrado', label: 'No encontrado' },
    { value: 'deteriorado', label: 'Deteriorado' }
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Auditoría no indicada';
      this.loading = false;
      return;
    }
    this.cargar(id);
  }

  get itemsVisibles(): AuditoriaStockItem[] {
    const items = this.auditoria?.items || [];
    return this.soloPendientes ? items.filter((i) => !i.controlado) : items;
  }

  get pendientes(): number {
    return (this.auditoria?.items || []).filter((i) => !i.controlado).length;
  }

  get progreso(): number {
    if (!this.auditoria?.total_items) return 0;
    return Math.round((this.auditoria.items_controlados / this.auditoria.total_items) * 100);
  }

  get enCurso(): boolean {
    return this.auditoria?.estado === 'en_curso';
  }

  cargar(id: string): void {
    this.loading = true;
    this.auditoriasService.getAuditoriaDetalle(id).subscribe({
      next: (auditoria) => {
        this.auditoria = auditoria;
        this.borradores = {};
        (auditoria.items || []).forEach((item) => {
          this.borradores[item.id] = {
            estado_item: item.controlado ? item.estado_item : 'ok',
            cantidad_contada: item.cantidad_contada ?? item.cantidad_sistema,
            motivo: item.motivo_desvio || '',
            observaciones: item.observaciones || ''
          };
        });
        this.auditoriasService.getResumenDesvios(id).subscribe({
          next: (resumen) => this.resumen = resumen
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Error al cargar la auditoría';
        this.loading = false;
      }
    });
  }

  controlar(item: AuditoriaStockItem): void {
    const datos = this.borradores[item.id];
    if (!datos) return;
    this.guardando = true;
    this.auditoriasService.controlarItem(item.id, {
      estado_item: datos.estado_item,
      cantidad_contada: datos.estado_item === 'no_encontrado' ? 0 : datos.cantidad_contada,
      motivo: datos.motivo,
      observaciones: datos.observaciones
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.cargar(this.auditoria!.id);
      },
      error: (err) => {
        this.error = err.message || 'No se pudo guardar el control';
        this.guardando = false;
      }
    });
  }

  cerrar(): void {
    if (!this.auditoria || this.pendientes > 0) return;
    this.guardando = true;
    this.auditoriasService.cerrarAuditoria(this.auditoria.id, this.aplicarAjustes).subscribe({
      next: () => {
        this.guardando = false;
        this.cargar(this.auditoria!.id);
      },
      error: (err) => {
        this.error = err.message || 'No se pudo cerrar la auditoría';
        this.guardando = false;
      }
    });
  }

  cancelar(): void {
    if (!this.auditoria) return;
    if (!confirm('¿Cancelar esta auditoría? No se aplicarán ajustes.')) return;
    this.auditoriasService.cancelarAuditoria(this.auditoria.id).subscribe({
      next: () => this.volverAAuditorias(),
      error: (err) => this.error = err.message || 'No se pudo cancelar'
    });
  }

  abrirAgregar(): void {
    if (!this.auditoria) return;
    this.mostrarAgregar = true;
    this.stockService.getStockPorDeposito(this.auditoria.deposito_id).subscribe({
      next: (stock) => {
        const ya = new Set((this.auditoria?.items || []).map((i) => i.stock_deposito_id));
        this.stockDisponible = stock.filter((s) => !ya.has(s.id));
      }
    });
  }

  agregarSeleccionados(): void {
    if (!this.auditoria) return;
    const ids = [...this.seleccionAgregar];
    if (!ids.length) return;
    this.guardando = true;
    this.auditoriasService.agregarItems(this.auditoria.id, ids).subscribe({
      next: () => {
        this.mostrarAgregar = false;
        this.seleccionAgregar.clear();
        this.guardando = false;
        this.cargar(this.auditoria!.id);
      },
      error: (err) => {
        this.error = err.message || 'No se pudieron agregar items';
        this.guardando = false;
      }
    });
  }

  toggleAgregar(id: string): void {
    if (this.seleccionAgregar.has(id)) this.seleccionAgregar.delete(id);
    else this.seleccionAgregar.add(id);
  }

  etiquetaEstado(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente',
      ok: 'OK',
      con_desvio: 'Con desvío',
      no_encontrado: 'No encontrado',
      deteriorado: 'Deteriorado'
    };
    return map[estado] || estado;
  }

  exportarCSV(): void {
    if (!this.auditoria) return;
    const headers = ['Insumo', 'Código', 'Ubicación', 'Sistema', 'Contada', 'Desvío', 'Estado', 'Controlado', 'Motivo'];
    const rows = (this.auditoria.items || []).map((i) => [
      i.insumo_nombre || '',
      i.insumo_codigo || '',
      i.ubicacion_codigo || '',
      String(i.cantidad_sistema),
      i.cantidad_contada == null ? '' : String(i.cantidad_contada),
      i.desvio == null ? '' : String(i.desvio),
      i.estado_item,
      i.controlado ? 'sí' : 'no',
      i.motivo_desvio || ''
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${this.auditoria.tipo}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportarPDF(): void {
    if (!this.auditoria || !this.resumen) return;
    this.pdfService.generateAuditoriaPdf(this.auditoria, this.resumen);
  }

  volver(): void {
    this.volverAAuditorias();
  }

  private volverAAuditorias(): void {
    const deposito = this.route.snapshot.queryParamMap.get('deposito') || this.auditoria?.deposito_id;
    this.router.navigate(['/stock/auditorias'], deposito ? { queryParams: { deposito } } : undefined);
  }
}
