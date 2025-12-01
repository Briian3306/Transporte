import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { IncidenteConfigService } from '../../services/incidente-config.service';
import { NivelRiesgo, TipoIncidente, SubtipoIncidente } from '../../models/incidente.model';

@Component({
  selector: 'app-incidente-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './incidente-config.component.html',
  styleUrl: './incidente-config.component.scss'
})
export class IncidenteConfigComponent implements OnInit {
  private incidenteConfigService = inject(IncidenteConfigService);
  private fb = inject(FormBuilder);

  // Estados
  loading = false;
  error: string | null = null;
  success: string | null = null;
  activeTab = 'niveles';

  // Datos
  nivelesRiesgo: NivelRiesgo[] = [];
  tiposIncidente: TipoIncidente[] = [];

  // Formularios
  nivelesForm: FormGroup;
  tiposForm: FormGroup;

  constructor() {
    this.nivelesForm = this.fb.group({
      niveles: this.fb.array([])
    });

    this.tiposForm = this.fb.group({
      tipos: this.fb.array([])
    });
  }

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.loading = true;
    this.error = null;

    // Cargar niveles de riesgo
    this.incidenteConfigService.getNivelesRiesgo().subscribe({
      next: (niveles) => {
        this.nivelesRiesgo = niveles;
        this.buildNivelesForm();
      },
      error: (err) => {
        this.error = err.message;
        this.loading = false;
      }
    });

    // Cargar tipos de incidente
    this.incidenteConfigService.getTiposIncidente().subscribe({
      next: (tipos) => {
        this.tiposIncidente = tipos;
        this.buildTiposForm();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  private buildNivelesForm() {
    const nivelesArray = this.nivelesForm.get('niveles') as FormArray;
    nivelesArray.clear();

    this.nivelesRiesgo.forEach(nivel => {
      nivelesArray.push(this.createNivelFormGroup(nivel));
    });
  }

  private buildTiposForm() {
    const tiposArray = this.tiposForm.get('tipos') as FormArray;
    tiposArray.clear();

    this.tiposIncidente.forEach(tipo => {
      tiposArray.push(this.createTipoFormGroup(tipo));
    });
  }

  private createNivelFormGroup(nivel: NivelRiesgo): FormGroup {
    return this.fb.group({
      codigo: [nivel.codigo, Validators.required],
      nombre: [nivel.nombre, Validators.required],
      puntaje_minimo: [nivel.puntaje_minimo, [Validators.required, Validators.min(0)]],
      color: [nivel.color, Validators.required],
      icono: [nivel.icono || ''],
      responsable: [nivel.responsable, Validators.required],
      tiempo_respuesta: [nivel.tiempo_respuesta, Validators.required],
      orden: [nivel.orden, [Validators.required, Validators.min(1)]]
    });
  }

  private createTipoFormGroup(tipo: TipoIncidente): FormGroup {
    return this.fb.group({
      codigo: [tipo.codigo, Validators.required],
      nombre: [tipo.nombre, Validators.required],
      descripcion: [tipo.descripcion || ''],
      icono: [tipo.icono || ''],
      peso_base: [tipo.peso_base, [Validators.required, Validators.min(0)]],
      requiere_patente: [tipo.requiere_patente],
      requiere_ubicacion_detallada: [tipo.requiere_ubicacion_detallada],
      orden: [tipo.orden, [Validators.required, Validators.min(1)]],
      subtipos: this.fb.array(tipo.subtipos.map(subtipo => this.createSubtipoFormGroup(subtipo)))
    });
  }

  private createSubtipoFormGroup(subtipo: SubtipoIncidente): FormGroup {
    return this.fb.group({
      codigo: [subtipo.codigo, Validators.required],
      nombre: [subtipo.nombre, Validators.required],
      peso: [subtipo.peso, [Validators.required, Validators.min(0)]],
      indicaciones: this.fb.array(subtipo.indicaciones.map(ind => this.fb.control(ind))),
      acciones: this.fb.array(subtipo.acciones.map(acc => this.fb.control(acc))),
      orden: [subtipo.orden, [Validators.required, Validators.min(1)]]
    });
  }

  // Métodos para niveles de riesgo
  get nivelesArray(): FormArray {
    return this.nivelesForm.get('niveles') as FormArray;
  }

  addNivel() {
    const nuevoNivel: NivelRiesgo = {
      codigo: '',
      nombre: '',
      puntaje_minimo: 0,
      color: '#000000',
      icono: '',
      responsable: '',
      tiempo_respuesta: '',
      orden: this.nivelesArray.length + 1
    };

    this.nivelesArray.push(this.createNivelFormGroup(nuevoNivel));
  }

  removeNivel(index: number) {
    if (this.nivelesArray.length > 1) {
      this.nivelesArray.removeAt(index);
    }
  }

  // Métodos para tipos de incidente
  get tiposArray(): FormArray {
    return this.tiposForm.get('tipos') as FormArray;
  }

  addTipo() {
    const nuevoTipo: TipoIncidente = {
      codigo: '',
      nombre: '',
      descripcion: '',
      icono: '',
      peso_base: 0,
      requiere_patente: false,
      requiere_ubicacion_detallada: false,
      orden: this.tiposArray.length + 1,
      subtipos: []
    };

    this.tiposArray.push(this.createTipoFormGroup(nuevoTipo));
  }

  removeTipo(index: number) {
    this.tiposArray.removeAt(index);
  }

  // Métodos para subtipos
  getSubtiposArray(tipoIndex: number): FormArray {
    return this.tiposArray.at(tipoIndex).get('subtipos') as FormArray;
  }

  addSubtipo(tipoIndex: number) {
    const nuevoSubtipo: SubtipoIncidente = {
      codigo: '',
      nombre: '',
      peso: 0,
      indicaciones: [],
      acciones: [],
      orden: this.getSubtiposArray(tipoIndex).length + 1
    };

    this.getSubtiposArray(tipoIndex).push(this.createSubtipoFormGroup(nuevoSubtipo));
  }

  removeSubtipo(tipoIndex: number, subtipoIndex: number) {
    this.getSubtiposArray(tipoIndex).removeAt(subtipoIndex);
  }

  // Métodos para indicaciones y acciones
  getIndicacionesArray(tipoIndex: number, subtipoIndex: number): FormArray {
    return this.getSubtiposArray(tipoIndex).at(subtipoIndex).get('indicaciones') as FormArray;
  }

  getAccionesArray(tipoIndex: number, subtipoIndex: number): FormArray {
    return this.getSubtiposArray(tipoIndex).at(subtipoIndex).get('acciones') as FormArray;
  }

  addIndicacion(tipoIndex: number, subtipoIndex: number) {
    this.getIndicacionesArray(tipoIndex, subtipoIndex).push(this.fb.control(''));
  }

  removeIndicacion(tipoIndex: number, subtipoIndex: number, index: number) {
    this.getIndicacionesArray(tipoIndex, subtipoIndex).removeAt(index);
  }

  addAccion(tipoIndex: number, subtipoIndex: number) {
    this.getAccionesArray(tipoIndex, subtipoIndex).push(this.fb.control(''));
  }

  removeAccion(tipoIndex: number, subtipoIndex: number, index: number) {
    this.getAccionesArray(tipoIndex, subtipoIndex).removeAt(index);
  }

  // Guardar configuraciones
  saveNiveles() {
    if (this.nivelesForm.valid) {
      this.loading = true;
      this.error = null;
      this.success = null;

      const niveles = this.nivelesArray.value;
      this.incidenteConfigService.updateNivelesRiesgo(niveles).subscribe({
        next: () => {
          this.success = 'Niveles de riesgo actualizados correctamente';
          this.loading = false;
        },
        error: (err) => {
          this.error = err.message;
          this.loading = false;
        }
      });
    } else {
      this.error = 'Por favor, complete todos los campos requeridos';
    }
  }

  saveTipos() {
    if (this.tiposForm.valid) {
      this.loading = true;
      this.error = null;
      this.success = null;

      const tipos = this.tiposArray.value;
      this.incidenteConfigService.updateTiposIncidente(tipos).subscribe({
        next: () => {
          this.success = 'Tipos de incidente actualizados correctamente';
          this.loading = false;
        },
        error: (err) => {
          this.error = err.message;
          this.loading = false;
        }
      });
    } else {
      this.error = 'Por favor, complete todos los campos requeridos';
    }
  }

  // Cambiar pestaña
  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.error = null;
    this.success = null;
  }

  // Limpiar mensajes
  clearMessages() {
    this.error = null;
    this.success = null;
  }

  // Obtener clase de color para nivel de riesgo
  getNivelColorClass(color: string): string {
    return `bg-[${color}]`;
  }
}

