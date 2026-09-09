import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Empresa, PEAJES_CATALOGO_SERVICE, Peaje, PeajesCatalogoService } from '../../models';
import {
  DataTableColumn,
  DataTableColumnDirective,
  DataTableComponent,
  DataTablePageChange,
} from '../../../shared';

@Component({
  selector: 'app-catalogo-peajes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    DataTableComponent,
    DataTableColumnDirective,
  ],
  templateUrl: './catalogo-peajes.component.html',
  styleUrl: './catalogo-peajes.component.css',
})
export class CatalogoPeajesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  peajes: Peaje[] = [];
  empresas: Empresa[] = [];
  page = 1;
  pageSize = 50;
  editandoId: string | null = null;
  error: string | null = null;
  guardando = false;

  crearEmpresaAbierto = false;
  nuevaEmpresaNombre = '';
  nuevaEmpresaDescripcion = '';

  readonly columns: DataTableColumn[] = [
    {
      key: 'nombre',
      label: 'Nombre',
      filter: { type: 'text', placeholder: 'Filtrar nombre…' },
      searchable: true,
    },
    {
      key: 'empresa',
      label: 'Empresa',
      filter: { type: 'search-select', placeholder: 'Filtrar empresa…' },
    },
    {
      key: 'ubicacion',
      label: 'Ubicación',
      filter: { type: 'text', placeholder: 'Filtrar ubicación…' },
    },
    { key: 'acciones', label: '', templateOnly: true, width: '6rem', align: 'right' },
  ];

  form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    ubicacion: [''],
    descripcion: [''],
    empresa_id: [''],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  get tableRows(): Record<string, unknown>[] {
    return this.peajes.map((p) => ({
      ...p,
      empresa: this.nombreEmpresa(p.empresa_id),
      ubicacion: p.ubicacion || '—',
    })) as unknown as Record<string, unknown>[];
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarEmpresas(), this.cargar()]);
  }

  async cargarEmpresas(): Promise<void> {
    this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
  }

  async cargar(): Promise<void> {
    this.peajes = await firstValueFrom(this.catalogo.listarPeajes());
  }

  nombreEmpresa(empresaId: string | null | undefined): string {
    if (!empresaId) {
      return '—';
    }
    return this.empresas.find((e) => e.id === empresaId)?.nombre ?? empresaId;
  }

  onPageChange(ev: DataTablePageChange): void {
    this.page = ev.page;
    this.pageSize = ev.pageSize;
  }

  nuevo(): void {
    this.editandoId = null;
    this.form.reset({ nombre: '', ubicacion: '', descripcion: '', empresa_id: '' });
  }

  editar(row: Record<string, unknown>): void {
    const p = row as unknown as Peaje;
    this.editandoId = p.id;
    this.form.patchValue({
      nombre: p.nombre,
      ubicacion: p.ubicacion ?? '',
      descripcion: p.descripcion ?? '',
      empresa_id: p.empresa_id ?? '',
    });
  }

  async crearEmpresa(): Promise<void> {
    if (!this.nuevaEmpresaNombre.trim()) {
      return;
    }
    this.error = null;
    try {
      const empresa = await firstValueFrom(
        this.catalogo.crearEmpresa({
          nombre: this.nuevaEmpresaNombre.trim(),
          descripcion: this.nuevaEmpresaDescripcion.trim() || null,
        })
      );
      this.empresas = [...this.empresas, empresa].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es')
      );
      this.form.patchValue({ empresa_id: empresa.id });
      this.crearEmpresaAbierto = false;
      this.nuevaEmpresaNombre = '';
      this.nuevaEmpresaDescripcion = '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo crear la empresa';
    }
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
      const data = {
        nombre: v.nombre,
        ubicacion: v.ubicacion || null,
        descripcion: v.descripcion || null,
        empresa_id: v.empresa_id || null,
      };
      if (this.editandoId) {
        await firstValueFrom(this.catalogo.actualizarPeaje(this.editandoId, data));
      } else {
        await firstValueFrom(this.catalogo.crearPeaje(data));
      }
      this.nuevo();
      await this.cargar();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al guardar';
    } finally {
      this.guardando = false;
    }
  }
}
