import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PEAJES_CATALOGO_SERVICE, Peaje, PeajesCatalogoService } from '../../models';
import { PEAJES_CATALOGOS_MOCK_PROVIDERS } from '../catalogos.providers';

@Component({
  selector: 'app-catalogo-peajes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  providers: PEAJES_CATALOGOS_MOCK_PROVIDERS,
  templateUrl: './catalogo-peajes.component.html',
  styleUrl: './catalogo-peajes.component.css',
})
export class CatalogoPeajesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  peajes: Peaje[] = [];
  editandoId: string | null = null;
  error: string | null = null;
  guardando = false;

  form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    ubicacion: [''],
    descripcion: [''],
    empresa_id: [''],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.peajes = await firstValueFrom(this.catalogo.listarPeajes());
  }

  nuevo(): void {
    this.editandoId = null;
    this.form.reset({ nombre: '', ubicacion: '', descripcion: '', empresa_id: '' });
  }

  editar(p: Peaje): void {
    this.editandoId = p.id;
    this.form.patchValue({
      nombre: p.nombre,
      ubicacion: p.ubicacion ?? '',
      descripcion: p.descripcion ?? '',
      empresa_id: p.empresa_id ?? '',
    });
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
