import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Documento,
  Estacion,
  PasadaGestion,
  Pase,
  Patente,
  stationBadgeFromCoords,
} from '../models';
import { formatUtcDateTime } from '../wizard/services/peajes-fecha.util';

export type PasadasDrawerMode = 'view' | 'edit' | 'create';

export interface PasadasFormPayload {
  fecha_hora: string;
  pase_id: string;
  patente_id: string;
  estacion_id: string;
  documento_id: string;
  precio: number;
  bonificacion: number;
  quantity: number;
}

@Component({
  selector: 'app-pasadas-form-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './pasadas-form-drawer.component.html',
  styleUrl: './pasadas-form-drawer.component.css',
})
export class PasadasFormDrawerComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() open = false;
  @Input() mode: PasadasDrawerMode = 'view';
  @Input() row: PasadaGestion | null = null;
  @Input() estaciones: Estacion[] = [];
  @Input() patentes: Patente[] = [];
  @Input() pases: Pase[] = [];
  @Input() facturas: Pick<Documento, 'id' | 'factura' | 'empresa_id'>[] = [];
  @Input() saving = false;
  @Input() error: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() save = new EventEmitter<PasadasFormPayload>();
  @Output() editRequest = new EventEmitter<void>();
  @Output() deleteRequest = new EventEmitter<void>();

  form = this.fb.nonNullable.group({
    fecha_hora: ['', Validators.required],
    estacion_id: ['', Validators.required],
    patente_id: ['', Validators.required],
    pase_id: ['', Validators.required],
    documento_id: ['', Validators.required],
    precio: [0, [Validators.required]],
    bonificacion: [0],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  get readonly(): boolean {
    return this.mode === 'view';
  }

  get title(): string {
    if (this.mode === 'create') return 'Nueva pasada';
    if (this.mode === 'edit') return 'Editar pasada';
    return 'Detalle de pasada';
  }

  get badge(): 'OK' | 'PENDING' {
    if (this.mode === 'create') {
      const est = this.estaciones.find((e) => e.id === this.form.controls.estacion_id.value);
      return stationBadgeFromCoords(est?.latitud, est?.longitud);
    }
    return stationBadgeFromCoords(this.row?.estacion_latitud, this.row?.estacion_longitud);
  }

  formatCreatedAt(value: string | null | undefined): string {
    return formatUtcDateTime(value, false);
  }

  get netoPreview(): number {
    const p = Number(this.form.controls.precio.value ?? 0);
    const b = Number(this.form.controls.bonificacion.value ?? 0);
    return p - b;
  }

  get pasesFiltrados(): Pase[] {
    const patenteId = this.form.controls.patente_id.value;
    if (!patenteId) return this.pases;
    return this.pases.filter((p) => p.patente_id === patenteId);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row'] || changes['mode'] || changes['open']) {
      this.syncForm();
    }
  }

  private syncForm(): void {
    if (this.mode === 'create') {
      this.form.reset({
        fecha_hora: '',
        estacion_id: '',
        patente_id: '',
        pase_id: '',
        documento_id: '',
        precio: 0,
        bonificacion: 0,
        quantity: 1,
      });
      this.form.enable();
      return;
    }

    if (!this.row) return;

    const local = this.toLocalInput(this.row.fecha_hora);
    this.form.reset({
      fecha_hora: local,
      estacion_id: this.row.estacion_id,
      patente_id: this.row.patente_id,
      pase_id: this.row.pase_id,
      documento_id: this.row.documento_id,
      precio: Number(this.row.precio),
      bonificacion: Number(this.row.bonificacion),
      quantity: Number(this.row.quantity),
    });

    if (this.readonly) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }

  private toLocalInput(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    // datetime-local shows the same UTC wall-clock as Supabase (no browser TZ shift).
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }

  submit(): void {
    if (this.readonly || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const fecha = String(v.fecha_hora || '').trim();
    const fechaHora = fecha.includes('T')
      ? `${fecha.replace('T', ' ')}${fecha.length === 16 ? ':00' : ''}`
      : fecha;
    this.save.emit({
      ...v,
      fecha_hora: fechaHora,
      precio: Number(v.precio),
      bonificacion: Number(v.bonificacion),
      quantity: Number(v.quantity),
    });
  }
}
