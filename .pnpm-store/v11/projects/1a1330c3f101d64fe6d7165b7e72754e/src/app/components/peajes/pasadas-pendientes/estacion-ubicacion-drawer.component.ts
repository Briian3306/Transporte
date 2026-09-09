import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EstacionPendienteGrupo, stationBadgeFromCoords } from '../models';

export interface EstacionUbicacionPayload {
  latitud: number | null;
  longitud: number | null;
  camino: string | null;
  ubicacion: string | null;
}

@Component({
  selector: 'app-estacion-ubicacion-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './estacion-ubicacion-drawer.component.html',
  styleUrl: './estacion-ubicacion-drawer.component.css',
})
export class EstacionUbicacionDrawerComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() open = false;
  @Input() group: EstacionPendienteGrupo | null = null;
  @Input() saving = false;
  @Input() error: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() save = new EventEmitter<EstacionUbicacionPayload>();

  form = this.fb.group({
    latitud: [null as number | null, Validators.required],
    longitud: [null as number | null, Validators.required],
    camino: ['' as string | null],
    ubicacion: ['' as string | null],
  });

  get badge(): 'OK' | 'PENDING' {
    return stationBadgeFromCoords(
      this.form.controls.latitud.value,
      this.form.controls.longitud.value
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['group'] || changes['open']) {
      this.syncForm();
    }
  }

  private syncForm(): void {
    if (!this.group) {
      this.form.reset({ latitud: null, longitud: null, camino: '', ubicacion: '' });
      return;
    }
    this.form.reset({
      latitud: this.group.estacion_latitud ?? null,
      longitud: this.group.estacion_longitud ?? null,
      camino: this.group.camino ?? '',
      ubicacion: this.group.ubicacion ?? '',
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.save.emit({
      latitud: v.latitud != null ? Number(v.latitud) : null,
      longitud: v.longitud != null ? Number(v.longitud) : null,
      camino: (v.camino || '').trim() || null,
      ubicacion: (v.ubicacion || '').trim() || null,
    });
  }
}
