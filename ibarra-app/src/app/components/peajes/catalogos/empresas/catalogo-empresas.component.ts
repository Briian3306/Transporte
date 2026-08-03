import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Empresa, PEAJES_CATALOGO_SERVICE, PeajesCatalogoService } from '../../models';

@Component({
  selector: 'app-catalogo-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './catalogo-empresas.component.html',
  styleUrl: '../peajes/catalogo-peajes.component.css',
})
export class CatalogoEmpresasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  empresas: Empresa[] = [];
  filtro = '';
  error: string | null = null;
  guardando = false;

  form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    descripcion: [''],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  get empresasFiltradas(): Empresa[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) {
      return this.empresas;
    }
    return this.empresas.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.nombre.toLowerCase().includes(q) ||
        (e.descripcion ?? '').toLowerCase().includes(q)
    );
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
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
