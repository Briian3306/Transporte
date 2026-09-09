import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IncidenteService } from '../../services/incidente.service';
import { IncidenteConfigService } from '../../services/incidente-config.service';
import { NivelRiesgo, TipoIncidente, SubtipoIncidente, CategoriaReportante } from '../../models/incidente.model';

@Component({
  selector: 'app-incidente-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './incidente-registro.component.html',
  styleUrl: './incidente-registro.component.scss'
})
export class IncidenteRegistroComponent implements OnInit {
  private incidenteService = inject(IncidenteService);
  private incidenteConfigService = inject(IncidenteConfigService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  // Estados
  loading = false;
  error: string | null = null;
  success: string | null = null;
  submitting = false;

  // Datos
  nivelesRiesgo: NivelRiesgo[] = [];
  tiposIncidente: TipoIncidente[] = [];
  subtiposDisponibles: SubtipoIncidente[] = [];
  nivelCalculado: NivelRiesgo | null = null;
  indicaciones: string[] = [];
  acciones: string[] = [];

  // Formulario
  incidenteForm: FormGroup;

  // Opciones para selects
  categoriasReportante: { value: CategoriaReportante; label: string; icon: string }[] = [
    { value: 'chofer', label: 'Chofer', icon: 'fas fa-truck' },
    { value: 'cliente', label: 'Cliente', icon: 'fas fa-user' },
    { value: 'policia', label: 'Policía', icon: 'fas fa-shield-alt' },
    { value: 'bomberos', label: 'Bomberos', icon: 'fas fa-fire-extinguisher' },
    { value: 'tercero', label: 'Tercero', icon: 'fas fa-users' },
    { value: 'otro', label: 'Otro', icon: 'fas fa-question' }
  ];

  constructor() {
    this.incidenteForm = this.fb.group({
      fecha: ['', Validators.required],
      hora: ['', Validators.required],
      nombre_reportante: ['', [Validators.required, Validators.minLength(2)]],
      telefono_reportante: ['', [Validators.required, Validators.pattern(/^[\+]?[0-9\s\-\(\)]{10,}$/)]],
      categoria_reportante: ['', Validators.required],
      motivo: ['', [Validators.required, Validators.minLength(5)]],
      ubicacion: ['', [Validators.required, Validators.minLength(5)]],
      patente: [''],
      tipo_incidente: ['', Validators.required],
      subtipo_incidente: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.initializeForm();
    this.loadData();
    this.setupFormListeners();
  }

  private initializeForm() {
    // Establecer fecha y hora actual
    const ahora = new Date();
    this.incidenteForm.patchValue({
      fecha: ahora.toISOString().split('T')[0],
      hora: ahora.toTimeString().slice(0, 5)
    });
  }

  private loadData() {
    this.loading = true;
    this.error = null;

    // Cargar niveles de riesgo
    this.incidenteConfigService.getNivelesRiesgo().subscribe({
      next: (niveles) => {
        this.nivelesRiesgo = niveles;
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
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  private setupFormListeners() {
    // Escuchar cambios en tipo de incidente
    this.incidenteForm.get('tipo_incidente')?.valueChanges.subscribe(tipoCodigo => {
      if (tipoCodigo) {
        this.loadSubtipos(tipoCodigo);
        this.incidenteForm.get('subtipo_incidente')?.setValue('');
      } else {
        this.subtiposDisponibles = [];
        this.incidenteForm.get('subtipo_incidente')?.setValue('');
      }
      this.clearCalculations();
    });

    // Escuchar cambios en subtipo de incidente
    this.incidenteForm.get('subtipo_incidente')?.valueChanges.subscribe(subtipoCodigo => {
      if (subtipoCodigo) {
        this.calculateRiskAndActions();
      } else {
        this.clearCalculations();
      }
    });

    // Escuchar cambios en campos para validaciones específicas
    this.incidenteForm.get('tipo_incidente')?.valueChanges.subscribe(() => {
      this.updateValidations();
    });
  }

  private loadSubtipos(tipoCodigo: string) {
    this.incidenteConfigService.getSubtiposByTipoFromCache(tipoCodigo).subscribe({
      next: (subtipos) => {
        this.subtiposDisponibles = subtipos;
      },
      error: (err) => {
        console.error('Error al cargar subtipos:', err);
        this.subtiposDisponibles = [];
      }
    });
  }

  private calculateRiskAndActions() {
    const tipoCodigo = this.incidenteForm.get('tipo_incidente')?.value;
    const subtipoCodigo = this.incidenteForm.get('subtipo_incidente')?.value;

    if (tipoCodigo && subtipoCodigo) {
      // Calcular puntaje
      const puntaje = this.incidenteConfigService.calcularPuntaje(tipoCodigo, subtipoCodigo, this.tiposIncidente);
      
      // Calcular nivel de riesgo
      this.incidenteConfigService.getNivelRiesgoByPuntaje(puntaje).subscribe({
        next: (nivel) => {
          this.nivelCalculado = nivel;
        }
      });

      // Obtener indicaciones y acciones del subtipo
      this.incidenteConfigService.getSubtipoIncidenteByCodigos(tipoCodigo, subtipoCodigo).subscribe({
        next: (subtipo) => {
          if (subtipo) {
            this.indicaciones = subtipo.indicaciones;
            this.acciones = subtipo.acciones;
          }
        }
      });
    }
  }

  private clearCalculations() {
    this.nivelCalculado = null;
    this.indicaciones = [];
    this.acciones = [];
  }

  private updateValidations() {
    const tipoCodigo = this.incidenteForm.get('tipo_incidente')?.value;
    const tipo = this.tiposIncidente.find(t => t.codigo === tipoCodigo);

    if (tipo) {
      // Actualizar validaciones según el tipo
      const patenteControl = this.incidenteForm.get('patente');
      const ubicacionControl = this.incidenteForm.get('ubicacion');

      if (tipo.requiere_patente) {
        patenteControl?.setValidators([Validators.required, Validators.minLength(3)]);
      } else {
        patenteControl?.clearValidators();
      }

      if (tipo.requiere_ubicacion_detallada) {
        ubicacionControl?.setValidators([Validators.required, Validators.minLength(10)]);
      } else {
        ubicacionControl?.setValidators([Validators.required, Validators.minLength(5)]);
      }

      patenteControl?.updateValueAndValidity();
      ubicacionControl?.updateValueAndValidity();
    }
  }

  // Métodos para el template
  getTipoIncidenteByCodigo(codigo: string): TipoIncidente | null {
    return this.tiposIncidente.find(t => t.codigo === codigo) || null;
  }

  getSubtipoIncidenteByCodigo(codigo: string): SubtipoIncidente | null {
    return this.subtiposDisponibles.find(s => s.codigo === codigo) || null;
  }

  getNivelRiesgoClass(): string {
    if (!this.nivelCalculado) return '';
    
    const colorMap: { [key: string]: string } = {
      'CRITICO': 'bg-red-100 text-red-800 border-red-200',
      'ALTO': 'bg-orange-100 text-orange-800 border-orange-200',
      'MEDIO': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'BAJO': 'bg-green-100 text-green-800 border-green-200'
    };
    
    return colorMap[this.nivelCalculado.codigo] || 'bg-gray-100 text-gray-800 border-gray-200';
  }

  getNivelRiesgoIcon(): string {
    return this.nivelCalculado?.icono || 'fas fa-exclamation-triangle';
  }

  getNivelRiesgoColor(): string {
    return this.nivelCalculado?.color || '#6b7280';
  }

  // Validaciones específicas
  getFieldError(fieldName: string): string | null {
    const field = this.incidenteForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return 'Este campo es requerido';
      }
      if (field.errors['minlength']) {
        return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
      }
      if (field.errors['pattern']) {
        return 'Formato inválido';
      }
    }
    return null;
  }

  // Enviar formulario
  onSubmit() {
    if (this.incidenteForm.valid && !this.submitting) {
      this.submitting = true;
      this.error = null;
      this.success = null;

      const formValue = this.incidenteForm.value;
      const tipoCodigo = formValue.tipo_incidente;
      const subtipoCodigo = formValue.subtipo_incidente;

      // Calcular datos finales
      const puntaje = this.incidenteConfigService.calcularPuntaje(tipoCodigo, subtipoCodigo, this.tiposIncidente);
      const nivel = this.nivelCalculado;

      if (!nivel) {
        this.error = 'No se pudo calcular el nivel de riesgo';
        this.submitting = false;
        return;
      }

      // Crear snapshot de configuración
      const tipo = this.getTipoIncidenteByCodigo(tipoCodigo);
      const subtipo = this.getSubtipoIncidenteByCodigo(subtipoCodigo);
      const configuracionSnapshot = {
        tipo,
        subtipo,
        nivel,
        puntaje,
        timestamp: new Date().toISOString()
      };

      // Preparar datos del incidente
      const incidenteData = {
        fecha: formValue.fecha,
        hora: formValue.hora,
        nombre_reportante: formValue.nombre_reportante,
        telefono_reportante: formValue.telefono_reportante,
        categoria_reportante: formValue.categoria_reportante,
        motivo: formValue.motivo,
        ubicacion: formValue.ubicacion,
        patente: formValue.patente || null,
        tipo_incidente: tipoCodigo,
        subtipo_incidente: subtipoCodigo,
        puntaje_total: puntaje,
        nivel_riesgo: nivel.codigo,
        indicaciones_aplicadas: this.indicaciones,
        acciones_aplicadas: this.acciones,
        configuracion_snapshot: configuracionSnapshot,
        estado_seguimiento: 'pendiente' as const,
        comentarios_seguimiento: []
      };

      // Enviar a la base de datos
      this.incidenteService.createIncidente(incidenteData).subscribe({
        next: (incidente) => {
          this.success = 'Incidente registrado correctamente';
          this.submitting = false;
          
          this.router.navigate(['/incidentes/historial']);
          // Limpiar formulario después de un breve delay
          setTimeout(() => {
            this.clearForm();
          }, 2000);
        },
        error: (err) => {
          this.error = err.message;
          this.submitting = false;
        }
      });
    } else {
      this.error = 'Por favor, complete todos los campos requeridos correctamente';
    }
  }

  private clearForm() {
    this.incidenteForm.reset();
    this.initializeForm();
    this.clearCalculations();
    this.subtiposDisponibles = [];
  }

  // Navegación
  goToHistory() {
    this.router.navigate(['/incidentes/historial']);
  }

  goToConfig() {
    this.router.navigate(['/incidentes/configuracion']);
  }

  // Limpiar mensajes
  clearMessages() {
    this.error = null;
    this.success = null;
  }
}

