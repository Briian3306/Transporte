import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../../services/supabase.service';
import { Documento, DocumentoTipo, DOCUMENTO_TIPOS, Empresa, PEAJES_CATALOGO_SERVICE, PeajesCatalogoService } from '../models';
import { DataTableColumn, DataTableColumnDirective, DataTableComponent, DataTablePageChange, DateRangePickerComponent, DateRangeValue, SearchMultiSelectComponent, SearchMultiSelectOption, rangeToIsoFilters } from '../../shared';

@Component({
  selector: 'app-documentos-plantillas-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DataTableColumnDirective, DateRangePickerComponent, SearchMultiSelectComponent],
  templateUrl: './documentos-plantillas-list.component.html',
  styleUrl: './plantillas-shared.css',
})
export class DocumentosPlantillasListComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  documentos: Documento[] = [];
  empresas: Empresa[] = [];
  loading = false;
  error: string | null = null;
  total = 0;
  page = 1;
  pageSize = 50;
  filters: { fecha_desde?: string | null; fecha_hasta?: string | null; empresa_ids?: string[]; factura?: string; tipo?: DocumentoTipo | '' } = {};
  readonly tipos = DOCUMENTO_TIPOS;
  readonly columns: DataTableColumn[] = [
    { key: 'fecha_factura', label: 'Fecha', sortable: true, width: '10rem' },
    { key: 'empresa_nombre', label: 'Empresa', sortable: true },
    { key: 'factura', label: 'Factura / documento', sortable: true },
    { key: 'tipo', label: 'Tipo', sortable: true, width: '7rem' },
    { key: 'importe_total', label: 'Total', sortable: true, align: 'right', width: '9rem' },
  ];

  constructor(@Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService) {}

  get empresaOptions(): SearchMultiSelectOption[] { return this.empresas.map((e) => ({ id: e.id, label: e.nombre })); }
  get dateRange(): DateRangeValue { return { from: this.filters.fecha_desde ? new Date(this.filters.fecha_desde) : null, to: this.filters.fecha_hasta ? new Date(this.filters.fecha_hasta) : null }; }
  get tableRows(): Record<string, unknown>[] { return this.documentos as unknown as Record<string, unknown>[]; }

  async ngOnInit(): Promise<void> {
    this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const client = await this.supabase.getClient();
      let query = client.from('documentos').select('*', { count: 'exact' }).order('fecha_factura', { ascending: false });
      if (this.filters.fecha_desde) query = query.gte('fecha_factura', this.filters.fecha_desde);
      if (this.filters.fecha_hasta) query = query.lte('fecha_factura', this.filters.fecha_hasta);
      if (this.filters.empresa_ids?.length) query = query.in('empresa_id', this.filters.empresa_ids);
      if (this.filters.factura?.trim()) query = query.ilike('factura', `%${this.filters.factura.trim()}%`);
      if (this.filters.tipo) query = query.eq('tipo', this.filters.tipo);
      const from = (this.page - 1) * this.pageSize;
      const { data, count, error } = await query.range(from, from + this.pageSize - 1);
      if (error) throw error;
      this.total = count ?? 0;
      const nombres = new Map(this.empresas.map((e) => [e.id, e.nombre]));
      this.documentos = (data ?? []).map((d) => ({ ...d, empresa_nombre: nombres.get(d.empresa_id) ?? d.empresa_id })) as Documento[];
    } catch (e) { this.error = e instanceof Error ? e.message : 'No se pudieron cargar los documentos'; this.documentos = []; this.total = 0; }
    finally { this.loading = false; }
  }

  onDateRange(range: DateRangeValue): void { const iso = rangeToIsoFilters(range); this.filters = { ...this.filters, fecha_desde: iso.fecha_desde, fecha_hasta: iso.fecha_hasta }; this.resetAndLoad(); }
  onEmpresas(ids: string[]): void { this.filters = { ...this.filters, empresa_ids: ids.length ? ids : undefined }; this.resetAndLoad(); }
  onFactura(value: string): void { this.filters = { ...this.filters, factura: value }; this.resetAndLoad(); }
  onTipo(value: string): void { this.filters = { ...this.filters, tipo: value as DocumentoTipo | '' }; this.resetAndLoad(); }
  onPageChange(ev: DataTablePageChange): void { this.page = ev.page; this.pageSize = ev.pageSize; void this.cargar(); }
  private resetAndLoad(): void { this.page = 1; void this.cargar(); }
}
