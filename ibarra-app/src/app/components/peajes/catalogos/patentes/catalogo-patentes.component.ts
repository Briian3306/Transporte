import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CategoriaPatente, PEAJES_CATALOGO_SERVICE, Patente, PeajesCatalogoService } from '../../models';
import { DataTableColumn, DataTableColumnDirective, DataTableComponent, DataTablePageChange } from '../../../shared';

@Component({
  selector: 'app-catalogo-patentes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DataTableComponent, DataTableColumnDirective],
  templateUrl: './catalogo-patentes.component.html',
  styleUrl: '../peajes/catalogo-peajes.component.css',
})
export class CatalogoPatentesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  patentes: Patente[] = [];
  categorias: CategoriaPatente[] = ['FLOTA CAMIONES', 'FLOTA UTILITARIA', 'REMIS', 'OBRA', 'AUTO'];
  page = 1;
  pageSize = 50;
  error: string | null = null;
  guardando = false;
  editandoId: string | null = null;

  readonly columns: DataTableColumn[] = [
    { key: 'patente', label: 'Patente', filter: { type: 'text', placeholder: 'Filtrar patente…' }, searchable: true },
    { key: 'categoria', label: 'Categoría', filter: { type: 'multiselect', placeholder: 'Filtrar categoría…' } },
    { key: 'tipo_trabajo', label: 'Tipo de trabajo', filter: { type: 'text', placeholder: 'Filtrar tipo…' } },
    { key: 'activa', label: 'Estado', filter: { type: 'multiselect', placeholder: 'Filtrar estado…', options: [{ id: 'true', label: 'Activa' }, { id: 'false', label: 'Inactiva' }] } },
    { key: 'acciones', label: '', templateOnly: true, width: '7rem', align: 'right' },
  ];

  form = this.fb.nonNullable.group({
    patente: ['', Validators.required],
    categoria: ['FLOTA CAMIONES' as CategoriaPatente, Validators.required],
    tipo_trabajo: [''],
  });

  constructor(@Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService) {}

  get tableRows(): Record<string, unknown>[] { return this.patentes as unknown as Record<string, unknown>[]; }
  asPatente(row: Record<string, unknown>): Patente { return row as unknown as Patente; }

  async ngOnInit(): Promise<void> { await this.cargar(); }
  async cargar(): Promise<void> { this.patentes = await firstValueFrom(this.catalogo.listarPatentes()); }
  onPageChange(ev: DataTablePageChange): void { this.page = ev.page; this.pageSize = ev.pageSize; }

  editar(row: Record<string, unknown>): void {
    const patente = row as unknown as Patente;
    this.editandoId = patente.id;
    this.form.reset({ patente: patente.patente, categoria: patente.categoria, tipo_trabajo: patente.tipo_trabajo ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.form.reset({ patente: '', categoria: 'FLOTA CAMIONES', tipo_trabajo: '' });
  }

  async cambiarEstado(patente: Patente): Promise<void> {
    this.error = null;
    try {
      await firstValueFrom(this.catalogo.actualizarPatente(patente.id, { activa: !patente.activa }));
      await this.cargar();
    } catch (e) { this.error = e instanceof Error ? e.message : 'No se pudo actualizar el estado'; }
  }

  async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.guardando = true;
    this.error = null;
    try {
      const v = this.form.getRawValue();
      const data = { patente: v.patente.trim().toUpperCase(), categoria: v.categoria, tipo_trabajo: v.tipo_trabajo.trim() || null };
      if (this.editandoId) await firstValueFrom(this.catalogo.actualizarPatente(this.editandoId, data));
      else await firstValueFrom(this.catalogo.crearPatente({ ...data, activa: true }));
      this.cancelarEdicion();
      await this.cargar();
    } catch (e) { this.error = e instanceof Error ? e.message : 'Error al guardar'; }
    finally { this.guardando = false; }
  }
}
