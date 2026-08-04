import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CategoriaPatente,
  PEAJES_CATALOGO_SERVICE,
  Patente,
  PeajesCatalogoService,
} from '../../models';
import {
  DataTableColumn,
  DataTableComponent,
  DataTablePageChange,
} from '../../../shared';

@Component({
  selector: 'app-catalogo-patentes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DataTableComponent],
  templateUrl: './catalogo-patentes.component.html',
  styleUrl: '../peajes/catalogo-peajes.component.css',
})
export class CatalogoPatentesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  patentes: Patente[] = [];
  categorias: CategoriaPatente[] = ['TRANSPORTE', 'REMIS'];
  page = 1;
  pageSize = 50;
  error: string | null = null;
  guardando = false;

  readonly columns: DataTableColumn[] = [
    {
      key: 'patente',
      label: 'Patente',
      filter: { type: 'text', placeholder: 'Filtrar patente…' },
      searchable: true,
    },
    {
      key: 'categoria',
      label: 'Categoría',
      filter: { type: 'multiselect', placeholder: 'Filtrar categoría…' },
    },
    { key: 'id', label: 'ID', width: '12rem' },
  ];

  form = this.fb.nonNullable.group({
    patente: ['', Validators.required],
    categoria: ['TRANSPORTE' as CategoriaPatente, Validators.required],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  get tableRows(): Record<string, unknown>[] {
    return this.patentes as unknown as Record<string, unknown>[];
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.patentes = await firstValueFrom(this.catalogo.listarPatentes());
  }

  onPageChange(ev: DataTablePageChange): void {
    this.page = ev.page;
    this.pageSize = ev.pageSize;
  }

  async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.guardando = true;
    this.error = null;
    try {
      const v = this.form.getRawValue();
      await firstValueFrom(
        this.catalogo.crearPatente({
          patente: v.patente.trim().toUpperCase(),
          categoria: v.categoria,
        })
      );
      this.form.reset({ patente: '', categoria: 'TRANSPORTE' });
      await this.cargar();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al guardar';
    } finally {
      this.guardando = false;
    }
  }
}
