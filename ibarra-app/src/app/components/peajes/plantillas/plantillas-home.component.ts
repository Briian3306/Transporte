import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PEAJES_PLANTILLAS_SERVICE,
  PlantillaConfiguracion,
  AlgoritmoCombinado,
  PeajesPlantillasService,
} from '../models';
import { PeajesMotorTransformacionService } from './motor/peajes-motor-transformacion.service';
import { PlantillaBuilderComponent } from './plantilla-builder.component';
import { AplicarPlantillaComponent } from './aplicar-plantilla.component';
import { AlgoritmoBuilderComponent } from './algoritmo-builder.component';

/**
 * Hub de plantillas y algoritmos (área plantillas/**).
 */
@Component({
  selector: 'app-plantillas-home',
  standalone: true,
  imports: [
    CommonModule,
    PlantillaBuilderComponent,
    AplicarPlantillaComponent,
    AlgoritmoBuilderComponent,
  ],
  templateUrl: './plantillas-home.component.html',
  styleUrl: './plantillas-shared.css',
})
export class PlantillasHomeComponent implements OnInit {
  private readonly motor = inject(PeajesMotorTransformacionService);

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService
  ) {}

  vista: 'lista' | 'builder' | 'aplicar' | 'algoritmos' = 'lista';
  plantillas: PlantillaConfiguracion[] = [];
  algoritmos: AlgoritmoCombinado[] = [];
  estrategias: string[] = [];

  ngOnInit(): void {
    this.estrategias = this.motor.getRegistry().codigos();
    this.plantillasSvc.listarPlantillas().subscribe((p) => (this.plantillas = p));
    this.plantillasSvc.listarAlgoritmos().subscribe((a) => (this.algoritmos = a));
  }

  mostrar(v: typeof this.vista): void {
    this.vista = v;
  }
}
