import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  Estacion,
  PEAJES_CATALOGO_SERVICE,
  Peaje,
  PeajesCatalogoService,
} from '../../models';
@Component({
  selector: 'app-catalogo-estaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './catalogo-estaciones.component.html',
  styleUrl: './catalogo-estaciones.component.css',
})
export class CatalogoEstacionesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  estaciones: Estacion[] = [];
  peajes: Peaje[] = [];
  sugeridas: Estacion[] = [];
  busqueda = '';
  filtroLista = '';
  error: string | null = null;
  guardando = false;
  editandoId: string | null = null;

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
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  get estacionesFiltradas(): Estacion[] {
    const q = this.filtroLista.trim().toLowerCase();
    if (!q) {
      return this.estaciones;
    }
    return this.estaciones.filter((e) => {
      const codigos = (e.codigos_proveedor ?? []).join(' ').toLowerCase();
      return (
        e.id.toLowerCase().includes(q) ||
        e.nombre.toLowerCase().includes(q) ||
        (e.peaje?.nombre ?? e.peaje_id).toLowerCase().includes(q) ||
        codigos.includes(q)
      );
    });
  }

  async ngOnInit(): Promise<void> {
    this.peajes = await firstValueFrom(this.catalogo.listarPeajes());
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.estaciones = await firstValueFrom(this.catalogo.listarEstaciones());
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
          estado_geocodificacion: v.latitud !== null && v.longitud !== null ? 'OK' as const : 'REVIEW' as const,
        };
      if (this.editandoId) await firstValueFrom(this.catalogo.actualizarEstacion(this.editandoId, data));
      else await firstValueFrom(this.catalogo.crearEstacion(data));
      this.cancelarEdicion();
      await this.cargar();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al guardar';
    } finally {
      this.guardando = false;
    }
  }

  editar(e: Estacion): void {
    this.editandoId = e.id;
    this.form.patchValue({ peaje_id: e.peaje_id, nombre: e.nombre, ubicacion: e.ubicacion ?? '', descripcion: e.descripcion ?? '', codigos_proveedor: (e.codigos_proveedor ?? []).join(', '), latitud: e.latitud ?? null, longitud: e.longitud ?? null, camino: e.camino ?? '' });
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.form.reset({ peaje_id: this.peajes[0]?.id ?? '', nombre: '', ubicacion: '', descripcion: '', codigos_proveedor: '', latitud: null, longitud: null, camino: '' });
  }
}
