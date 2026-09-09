import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Empresa, PEAJES_CATALOGO_SERVICE, PeajesCatalogoService } from '../../models';
import {
  DataTableColumn,
  DataTableColumnDirective,
  DataTableComponent,
  DataTablePageChange,
} from '../../../shared';

@Component({
  selector: 'app-catalogo-empresas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    DataTableComponent,
    DataTableColumnDirective,
  ],
  templateUrl: './catalogo-empresas.component.html',
  styleUrl: '../peajes/catalogo-peajes.component.css',
})
export class CatalogoEmpresasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  empresas: Empresa[] = [];
  page = 1;
  pageSize = 50;
  error: string | null = null;
  guardando = false;

  readonly columns: DataTableColumn[] = [
    {
      key: 'nombre',
      label: 'Nombre',
      filter: { type: 'text', placeholder: 'Filtrar nombre…' },
      searchable: true,
    },
    {
      key: 'descripcion',
      label: 'Descripción',
      filter: { type: 'text', placeholder: 'Filtrar descripción…' },
    },
    { key: 'id', label: 'ID', width: '12rem' },
  ];

  form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    descripcion: [''],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  get tableRows(): Record<string, unknown>[] {
    return this.empresas.map((e) => ({
      ...e,
      descripcion: e.descripcion || '—',
    })) as unknown as Record<string, unknown>[];
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
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
        this.catalogo.crearEmpresa({
          nombre: v.nombre.trim(),
          descripcion: v.descripcion.trim() || null,
        })
      );
      this.form.reset({ nombre: '', descripcion: '' });
      await this.cargar();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al guardar';
    } finally {
      this.guardando = false;
    }
  }
}
