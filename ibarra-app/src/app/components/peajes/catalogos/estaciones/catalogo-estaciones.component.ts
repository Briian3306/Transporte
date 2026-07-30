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
import { PEAJES_CATALOGOS_MOCK_PROVIDERS } from '../catalogos.providers';

@Component({
  selector: 'app-catalogo-estaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  providers: PEAJES_CATALOGOS_MOCK_PROVIDERS,
  templateUrl: './catalogo-estaciones.component.html',
  styleUrl: '../peajes/catalogo-peajes.component.css',
})
export class CatalogoEstacionesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  estaciones: Estacion[] = [];
  peajes: Peaje[] = [];
  sugeridas: Estacion[] = [];
  busqueda = '';
  error: string | null = null;
  guardando = false;

  form = this.fb.nonNullable.group({
    peaje_id: ['', Validators.required],
    nombre: ['', Validators.required],
    ubicacion: [''],
    descripcion: [''],
    codigos_proveedor: [''],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

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
      await firstValueFrom(
        this.catalogo.crearEstacion({
          peaje_id: v.peaje_id,
          nombre: v.nombre,
          ubicacion: v.ubicacion || null,
          descripcion: v.descripcion || null,
          codigos_proveedor: codigos.length ? codigos : null,
        })
      );
      this.form.reset({
        peaje_id: this.peajes[0]?.id ?? '',
        nombre: '',
        ubicacion: '',
        descripcion: '',
        codigos_proveedor: '',
      });
      await this.cargar();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al guardar';
    } finally {
      this.guardando = false;
    }
  }
}
