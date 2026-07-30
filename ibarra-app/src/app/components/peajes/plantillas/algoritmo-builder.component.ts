import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlgoritmoCombinado,
  AlgoritmoCombinadoPaso,
  PEAJES_PLANTILLAS_SERVICE,
  PeajesPlantillasService,
} from '../models';
import { EstadoRecursoPeaje } from '../models/peajes.types';
import { PeajesMotorTransformacionService } from './motor/peajes-motor-transformacion.service';
import { PEAJES_GLOBAL_EMPRESA_ID } from '../services';
import { validarPublicacionAlgoritmo } from './validacion/plantillas-validacion';
import { PasoEjecucion } from './motor/strategy.types';

const GLOBAL_EMPRESA_ID = PEAJES_GLOBAL_EMPRESA_ID;

interface PasoDraft {
  orden: number;
  algoritmo_codigo: string;
  parametrosJson: string;
}

/**
 * Builder de algoritmos combinados (F03-5, F03-6).
 */
@Component({
  selector: 'app-algoritmo-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './algoritmo-builder.component.html',
  styleUrl: './plantillas-shared.css',
})
export class AlgoritmoBuilderComponent implements OnInit {
  private readonly motor = inject(PeajesMotorTransformacionService);

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService
  ) {}

  algoritmos: AlgoritmoCombinado[] = [];
  algoritmoId: string | null = null;
  nombre = '';
  descripcion = '';
  empresaId = 'empresa-demo';
  esGlobal = false;
  estado: EstadoRecursoPeaje = 'borrador';
  pasos: PasoDraft[] = [];
  codigosDisponibles: string[] = [];

  pasosEfectivos: PasoEjecucion[] = [];
  mensaje: string | null = null;
  error: string | null = null;
  errores: string[] = [];
  guardando = false;

  ngOnInit(): void {
    this.codigosDisponibles = this.motor.getRegistry().codigos();
    this.recargarLista();
    this.agregarPaso();
  }

  recargarLista(): void {
    this.plantillasSvc.listarAlgoritmos().subscribe((list) => (this.algoritmos = list));
  }

  seleccionar(id: string): void {
    this.plantillasSvc.listarAlgoritmos().subscribe((list) => {
      const alg = list.find((a) => a.id === id);
      if (!alg) return;
      this.algoritmoId = alg.id;
      this.nombre = alg.nombre;
      this.descripcion = alg.descripcion ?? '';
      this.empresaId = alg.empresa_id;
      this.esGlobal = alg.empresa_id === GLOBAL_EMPRESA_ID;
      this.estado = alg.estado;
      this.pasos = (alg.pasos ?? []).map((p) => ({
        orden: p.orden,
        algoritmo_codigo: p.algoritmo_codigo,
        parametrosJson: JSON.stringify(p.parametros ?? {}),
      }));
      this.expandir();
    });
  }

  agregarPaso(): void {
    const next = this.pasos.reduce((m, p) => Math.max(m, p.orden), 0) + 1;
    this.pasos.push({ orden: next, algoritmo_codigo: '', parametrosJson: '{}' });
  }

  quitarPaso(i: number): void {
    this.pasos.splice(i, 1);
  }

  expandir(): void {
    this.error = null;
    this.pasosEfectivos = [];
    try {
      const alg = this.comoAlgoritmoTemporal();
      this.pasosEfectivos = this.motor.expandirAlgoritmo(alg);
      this.mensaje = `Pasos efectivos: ${this.pasosEfectivos.map((p) => p.algoritmoCodigo).join(' → ')}`;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al expandir';
    }
  }

  guardar(): void {
    this.error = null;
    this.mensaje = null;
    this.errores = [];

    let pasosOmit: Omit<AlgoritmoCombinadoPaso, 'id' | 'algoritmo_combinado_id'>[];
    try {
      pasosOmit = this.pasos.map((p, i) => {
        if (!p.algoritmo_codigo) {
          throw new Error(`Paso ${i + 1} sin algoritmo_codigo`);
        }
        if (!this.motor.getRegistry().tiene(p.algoritmo_codigo)) {
          throw new Error(
            `No se permite referenciar códigos no registrados: ${p.algoritmo_codigo}`
          );
        }
        let parametros: Record<string, unknown> | null = null;
        try {
          parametros = p.parametrosJson ? JSON.parse(p.parametrosJson) : null;
        } catch {
          throw new Error(`JSON inválido en paso ${i + 1}`);
        }
        return {
          orden: Number(p.orden),
          algoritmo_codigo: p.algoritmo_codigo,
          parametros,
        };
      });
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Definición inválida';
      return;
    }

    const empresa = this.esGlobal ? GLOBAL_EMPRESA_ID : this.empresaId;
    const validacion = validarPublicacionAlgoritmo(
      { nombre: this.nombre, empresa_id: empresa },
      pasosOmit,
      this.motor.getRegistry()
    );
    if (!validacion.ok) {
      this.errores = validacion.errores.map((e) => e.motivo);
      this.error = 'Publicación bloqueada por validación';
      return;
    }

    this.guardando = true;
    this.plantillasSvc
      .guardarAlgoritmo(
        {
          id: this.algoritmoId ?? undefined,
          nombre: this.nombre,
          descripcion: this.descripcion || null,
          empresa_id: empresa,
          estado: this.estado,
        },
        pasosOmit
      )
      .subscribe({
        next: (saved) => {
          this.algoritmoId = saved.id;
          this.guardando = false;
          this.mensaje = `Algoritmo guardado (${saved.nombre})`;
          this.recargarLista();
          this.expandir();
        },
        error: (err) => {
          this.guardando = false;
          this.error = err?.message ?? 'Error al guardar';
        },
      });
  }

  private comoAlgoritmoTemporal(): AlgoritmoCombinado {
    return {
      id: this.algoritmoId ?? 'tmp',
      nombre: this.nombre || 'tmp',
      empresa_id: this.empresaId,
      estado: this.estado,
      pasos: this.pasos.map((p, i) => ({
        id: `tmp-${i}`,
        algoritmo_combinado_id: this.algoritmoId ?? 'tmp',
        orden: Number(p.orden),
        algoritmo_codigo: p.algoritmo_codigo,
        parametros: p.parametrosJson ? JSON.parse(p.parametrosJson) : null,
      })),
    };
  }
}
