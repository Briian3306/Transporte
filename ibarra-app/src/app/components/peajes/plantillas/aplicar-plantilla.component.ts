import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlgoritmoCombinado,
  ErrorValidacionPasada,
  PlantillaConfiguracion,
  PEAJES_PLANTILLAS_SERVICE,
  PeajesPlantillasService,
} from '../models';
import { PeajesMotorTransformacionService } from './motor/peajes-motor-transformacion.service';
import {
  COLUMNAS_ARCHIVO_DEMO,
  FILA_EJEMPLO_PRD_21,
} from './mocks/peajes-plantillas.mock';
import { puedeAplicarRecurso } from './validacion/plantillas-validacion';

/**
 * Aplicar plantilla existente + validar compatibilidad (F03-4, F03-8).
 * Pensado para embebido o pantalla; el wizard (02) puede reutilizar la lógica del motor.
 */
@Component({
  selector: 'app-aplicar-plantilla',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './aplicar-plantilla.component.html',
  styleUrl: './plantillas-shared.css',
})
export class AplicarPlantillaComponent implements OnInit {
  private readonly motor = inject(PeajesMotorTransformacionService);

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService
  ) {}

  empresaActiva = 'empresa-demo';
  plantillas: PlantillaConfiguracion[] = [];
  plantillaId = '';
  columnasArchivo = COLUMNAS_ARCHIVO_DEMO.join(', ');
  algoritmos: AlgoritmoCombinado[] = [];

  erroresCompat: ErrorValidacionPasada[] = [];
  bloqueada = false;
  resultado: Record<string, unknown> | null = null;
  mensaje: string | null = null;
  errorAlcance: string | null = null;

  ngOnInit(): void {
    this.recargar();
  }

  recargar(): void {
    this.plantillasSvc.listarPlantillas(this.empresaActiva).subscribe((list) => {
      this.plantillas = list;
    });
    this.plantillasSvc.listarAlgoritmos(this.empresaActiva).subscribe((a) => {
      this.algoritmos = a;
    });
  }

  onEmpresaChange(): void {
    this.recargar();
    this.resultado = null;
    this.erroresCompat = [];
    this.errorAlcance = null;
  }

  aplicar(): void {
    this.mensaje = null;
    this.errorAlcance = null;
    this.erroresCompat = [];
    this.resultado = null;
    this.bloqueada = false;

    const plantilla = this.plantillas.find((p) => p.id === this.plantillaId);
    if (!plantilla) {
      this.mensaje = 'Seleccioná una plantilla';
      return;
    }

    if (!puedeAplicarRecurso(plantilla.empresa_id, this.empresaActiva)) {
      this.errorAlcance =
        'Una plantilla de otra empresa no puede aplicarse salvo recurso global (RN-23)';
      this.bloqueada = true;
      return;
    }

    const columnas = this.columnasArchivo
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const errores = this.motor.validarCompatibilidad(
      plantilla.configuraciones ?? [],
      columnas
    );
    if (errores.length) {
      this.erroresCompat = errores;
      this.bloqueada = true;
      this.mensaje = 'Columnas faltantes requeridas por la plantilla. No se aplica.';
      return;
    }

    try {
      const rows = this.motor.aplicarPipeline(
        [FILA_EJEMPLO_PRD_21],
        plantilla.configuraciones ?? [],
        this.algoritmos
      );
      this.resultado = rows[0] ?? null;
      this.mensaje = 'Plantilla aplicada correctamente';
    } catch (e) {
      this.bloqueada = true;
      this.mensaje = e instanceof Error ? e.message : 'Error al aplicar';
    }
  }
}
