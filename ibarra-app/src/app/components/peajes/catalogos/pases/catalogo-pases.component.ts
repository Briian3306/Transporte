import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  Pase,
  Patente,
  PEAJES_CATALOGO_SERVICE,
  PeajesCatalogoService,
} from '../../models';
import {
  DataTableColumn,
  DataTableComponent,
  DataTablePageChange,
} from '../../../shared';

@Component({
  selector: 'app-catalogo-pases',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DataTableComponent],
  templateUrl: './catalogo-pases.component.html',
  styleUrl: '../peajes/catalogo-peajes.component.css',
})
export class CatalogoPasesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  pases: Pase[] = [];
  patentes: Patente[] = [];
  page = 1;
  pageSize = 50;
  error: string | null = null;
  guardando = false;

  readonly columns: DataTableColumn[] = [
    {
      key: 'pase',
      label: 'Pase',
      filter: { type: 'text', placeholder: 'Filtrar pase…' },
      searchable: true,
    },
    {
      key: 'patenteLabel',
      label: 'Patente',
      filter: { type: 'search-select', placeholder: 'Filtrar patente…' },
    },
    { key: 'id', label: 'ID', width: '12rem' },
  ];

  form = this.fb.nonNullable.group({
    pase: ['', Validators.required],
    patente_id: ['', Validators.required],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  get tableRows(): Record<string, unknown>[] {
    return this.pases.map((p) => ({
      ...p,
      patenteLabel: p.patente?.patente || p.patente_id,
    })) as unknown as Record<string, unknown>[];
  }

  async ngOnInit(): Promise<void> {
    this.patentes = await firstValueFrom(this.catalogo.listarPatentes());
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.pases = await firstValueFrom(this.catalogo.listarPases());
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
        this.catalogo.crearPase({
          pase: v.pase.trim(),
          patente_id: v.patente_id,
        })
      );
      this.form.reset({ pase: '', patente_id: this.patentes[0]?.id ?? '' });
      await this.cargar();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al guardar';
    } finally {
      this.guardando = false;
    }
  }
}
