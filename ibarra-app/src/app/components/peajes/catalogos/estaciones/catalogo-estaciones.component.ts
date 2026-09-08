import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  Estacion,
  EstacionViaSentido,
  PEAJES_CATALOGO_SERVICE,
  Peaje,
  PeajesCatalogoService,
} from '../../models';
import {
  DataTableColumn,
  DataTableColumnDirective,
  DataTableComponent,
  DataTablePageChange,
} from '../../../shared';
import { PermissionStateService } from '../../../../services/permission-state.service';

@Component({
  selector: 'app-catalogo-estaciones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    DataTableComponent,
    DataTableColumnDirective,
  ],
  templateUrl: './catalogo-estaciones.component.html',
  styleUrl: './catalogo-estaciones.component.css',
})
export class CatalogoEstacionesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  estaciones: Estacion[] = [];
  peajes: Peaje[] = [];
  sugeridas: Estacion[] = [];
  busqueda = '';
  page = 1;
  pageSize = 50;
  error: string | null = null;
  guardando = false;
  editandoId: string | null = null;
  viasSentido: EstacionViaSentido[] = [];
  viaCodigo = '';
  viaNombre = '';
  viaSentido: 'IDA' | 'VUELTA' = 'IDA';

  readonly columns: DataTableColumn[] = [
    {
      key: 'nombre',
      label: 'Nombre',
      filter: { type: 'text', placeholder: 'Filtrar nombre…' },
      searchable: true,
    },
    {
      key: 'peaje',
      label: 'Peaje',
      filter: { type: 'search-select', placeholder: 'Filtrar peaje…' },
    },
    { key: 'ubicacion', label: 'Ubicación' },
    {
      key: 'estado',
      label: 'Estado',
      width: '7rem',
      filter: { type: 'multiselect', placeholder: 'Filtrar estado…' },
    },
    { key: 'acciones', label: '', templateOnly: true, width: '6rem', align: 'right' },
  ];

  form = this.fb.nonNullable.group({
    peaje_id: ['', Validators.required],
    nombre: ['', Validators.required],
    ubicacion: [''],
    descripcion: [''],
    codigos_proveedor: [''],
    latitud: [null as number | null],
    longitud: [null as number | null],
    camino: [''],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService,
    private readonly permissions: PermissionStateService,
  ) {}

  get canEdit(): boolean {
    return this.permissions.hasPermission('peajes', 'create') || this.permissions.hasPermission('peajes', 'manage');
  }

  get tableRows(): Record<string, unknown>[] {
    return this.estaciones.map((e) => ({
      ...e,
      peaje: e.peaje?.nombre || e.peaje_id,
      ubicacion: `${e.camino || '—'} · ${e.latitud ?? '—'}, ${e.longitud ?? '—'}`,
      estado: e.estado_geocodificacion || 'REVIEW',
    })) as unknown as Record<string, unknown>[];
  }

  async ngOnInit(): Promise<void> {
    this.peajes = await firstValueFrom(this.catalogo.listarPeajes());
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.estaciones = await firstValueFrom(this.catalogo.listarEstaciones());
    if (this.editandoId) await this.cargarVias(this.editandoId);
  }

  private async cargarVias(estacionId: string): Promise<void> {
    const estacion = this.estaciones.find((item) => item.id === estacionId);
    const empresaId = estacion?.peaje?.empresa_id ?? this.peajes.find((p) => p.id === estacion?.peaje_id)?.empresa_id ?? undefined;
    this.viasSentido = await firstValueFrom(this.catalogo.listarEstacionesViasSentido(empresaId, estacionId));
  }

  async guardarViaSentido(): Promise<void> {
    if (!this.editandoId || !this.viaCodigo.trim() || !this.viaNombre.trim()) return;
    const estacion = this.estaciones.find((item) => item.id === this.editandoId);
    const empresaId = estacion?.peaje?.empresa_id ?? this.peajes.find((p) => p.id === estacion?.peaje_id)?.empresa_id;
    if (!empresaId) {
      this.error = 'La estación no tiene empresa/proveedor asociado.';
      return;
    }
    await firstValueFrom(this.catalogo.guardarEstacionViaSentido({
      empresa_id: empresaId,
      estacion_id: this.editandoId,
      codigo_estacion: this.viaCodigo,
      via: this.viaNombre,
      sentido: this.viaSentido,
    }));
    this.viaCodigo = '';
    this.viaNombre = '';
    await this.cargarVias(this.editandoId);
  }

  async eliminarViaSentido(row: EstacionViaSentido): Promise<void> {
    await firstValueFrom(this.catalogo.eliminarEstacionViaSentido(row.id));
    this.viasSentido = this.viasSentido.filter((item) => item.id !== row.id);
  }

  onPageChange(ev: DataTablePageChange): void {
    this.page = ev.page;
    this.pageSize = ev.pageSize;
  }

  async sugerir(): Promise<void> {
    this.sugeridas = await firstValueFrom(this.catalogo.sugerirEstacion(this.busqueda));
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
      const codigos = v.codigos_proveedor
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const data = {
        peaje_id: v.peaje_id,
        nombre: v.nombre,
        ubicacion: v.ubicacion || null,
        descripcion: v.descripcion || null,
        codigos_proveedor: codigos.length ? codigos : null,
        latitud: v.latitud,
        longitud: v.longitud,
        camino: v.camino || null,
        estado_geocodificacion:
          v.latitud !== null && v.longitud !== null ? ('OK' as const) : ('REVIEW' as const),
      };
      if (this.editandoId) {
        await firstValueFrom(this.catalogo.actualizarEstacion(this.editandoId, data));
      } else {
        await firstValueFrom(this.catalogo.crearEstacion(data));
      }
      this.cancelarEdicion();
      await this.cargar();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al guardar';
    } finally {
      this.guardando = false;
    }
  }

  editar(row: Record<string, unknown>): void {
    const e = row as unknown as Estacion;
    this.editandoId = e.id;
    this.form.patchValue({
      peaje_id: e.peaje_id,
      nombre: e.nombre,
      ubicacion: e.ubicacion ?? '',
      descripcion: e.descripcion ?? '',
      codigos_proveedor: (e.codigos_proveedor ?? []).join(', '),
      latitud: e.latitud ?? null,
      longitud: e.longitud ?? null,
      camino: e.camino ?? '',
    });
    void this.cargarVias(e.id);
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.form.reset({
      peaje_id: this.peajes[0]?.id ?? '',
      nombre: '',
      ubicacion: '',
      descripcion: '',
      codigos_proveedor: '',
      latitud: null,
      longitud: null,
      camino: '',
    });
    this.viasSentido = [];
    this.viaCodigo = '';
    this.viaNombre = '';
  }
}
