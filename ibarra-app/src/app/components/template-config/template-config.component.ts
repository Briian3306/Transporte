import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ChecklistTemplateService } from '../../services/checklist-template.service';
import { 
  ChecklistTemplate, 
  ChecklistSection, 
  ChecklistItem, 
  ValidationType, 
  ValidationBehavior, 
  ValidationConfig,
  TemplateResourceType 
} from '../../models/checklist-template.model';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-template-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './template-config.component.html',
  styleUrls: ['./template-config.component.scss']
})
export class TemplateConfigComponent implements OnInit {
  // Estado de la aplicación
  plantillaActual: ChecklistTemplate = {
    id: '',
    nombre: '',
    descripcion: '',
    secciones: [],
    tipo: 'vehiculo',
    version: '1.0'
  };

  // Estados de edición
  itemEditando: ChecklistItem | null = null;
  indiceItemEditando: number = -1;
  seccionEditando: ChecklistSection | null = null;
  indiceSeccionEditando: number = -1;

  // Formularios
  formEditarItem: FormGroup;
  formNuevaPlantilla: FormGroup;
  formConfiguracionMinMax: FormGroup;

  // Estados de UI
  mostrarModalNuevaPlantilla = false;
  cargando = false;
  filtroItems = '';

  // Tipos de validación disponibles
  tiposValidacion: { [key: string]: { nombre: string; opciones: string[] } } = {
    sin_validacion: { nombre: 'Sin validación', opciones: [] },
    si_no: { nombre: 'Sí/No', opciones: ['si', 'no'] },
    si_no_na: { nombre: 'Sí/No/N/A', opciones: ['si', 'no', 'na'] },
    valor_min_max: { nombre: 'Valor Min/Max', opciones: [] },
    cantidad: { nombre: 'Cantidad', opciones: [] },
    bueno_regular_malo: { nombre: 'Bueno/Regular/Malo', opciones: ['bueno', 'regular', 'malo'] },
    personalizado: { nombre: 'Personalizado', opciones: [] }
  };

  // Tipos de recurso disponibles
  tiposRecurso: { [key: string]: { nombre: string; descripcion: string; icono: string } } = {
    vehiculo: { nombre: 'Vehículo', descripcion: 'Checklist para inspección de vehículos', icono: '🚛' },
    chofer: { nombre: 'Chofer', descripcion: 'Checklist para evaluación de conductores', icono: '👨‍💼' },
    unidad: { nombre: 'Unidad', descripcion: 'Checklist para inspección de unidades', icono: '🚚' },
    maquina: { nombre: 'Máquina', descripcion: 'Checklist para inspección de máquinas', icono: '⚙️' },
    sector: { nombre: 'Sector/Área', descripcion: 'Checklist para áreas o sectores específicos', icono: '🏢' }
  };

  // Valores de error seleccionados
  valoresErrorSeleccionados: string[] = [];

  // Configuración para Min/Max
  configuracionMinMax = {
    valorMinimo: undefined as number | undefined,
    valorMaximo: undefined as number | undefined,
    generarErrorFueraRango: true
  };

  constructor(
    private fb: FormBuilder,
    private templateService: ChecklistTemplateService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.formEditarItem = this.fb.group({
      descripcion: ['', [Validators.required]],
      descripcionDetallada: [''],
      tipoValidacion: ['si_no_na'],
      comportamiento: ['genera_error'],
      esObligatorio: ['si']
    });

    this.formNuevaPlantilla = this.fb.group({
      nombre: ['', [Validators.required]],
      descripcion: [''],
      tipo: ['vehiculo', [Validators.required]]
    });

    this.formConfiguracionMinMax = this.fb.group({
      valorMinimo: [undefined],
      valorMaximo: [undefined],
      generarErrorFueraRango: [true]
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const templateId = params['id'];
      if (templateId) {
        this.cargarPlantillaExistente(templateId);
      } else {
        this.inicializarPlantillaVacia();
      }
    });
  }

  // ===== GESTIÓN DE TIPOS DE VALIDACIÓN =====
  onTipoValidacionChange(): void {
    const tipo = this.formEditarItem.get('tipoValidacion')?.value;
    this.valoresErrorSeleccionados = [];
    
    // Resetear configuración Min/Max
    this.formConfiguracionMinMax.reset({
      valorMinimo: undefined,
      valorMaximo: undefined,
      generarErrorFueraRango: true
    });
    
    // Resetear configuración específica según el tipo
    if (tipo === 'sin_validacion') {
      this.formEditarItem.get('comportamiento')?.setValue('sin_validacion');
    }
  }

  onOpcionesPersonalizadasChange(): void {
    // Esta función se ejecutará cuando cambien las opciones personalizadas
    // La lógica se manejará en el template
  }

  // ===== GESTIÓN DE VALORES DE ERROR =====
  toggleValorError(valor: string): void {
    const index = this.valoresErrorSeleccionados.indexOf(valor);
    if (index > -1) {
      this.valoresErrorSeleccionados.splice(index, 1);
    } else {
      this.valoresErrorSeleccionados.push(valor);
    }
  }

  isValorErrorSeleccionado(valor: string): boolean {
    return this.valoresErrorSeleccionados.includes(valor);
  }

  // ===== GESTIÓN DE SECCIONES =====
  agregarNuevaSeccion(): void {
    const titulo = prompt('Ingrese el título de la sección:');
    if (!titulo || !titulo.trim()) return;

    const seccion: ChecklistSection = {
      id: this.generarId(),
      titulo: titulo.trim(),
      items: [],
      orden: this.plantillaActual.secciones.length
    };

    this.plantillaActual.secciones.push(seccion);
  }

  seleccionarSeccion(indice: number): void {
    this.seccionEditando = this.plantillaActual.secciones[indice];
    this.indiceSeccionEditando = indice;
  }

  eliminarSeccion(indice: number): void {
    if (confirm('¿Está seguro de que desea eliminar esta sección y todos sus ítems?')) {
      this.plantillaActual.secciones.splice(indice, 1);
      if (this.indiceSeccionEditando === indice) {
        this.seccionEditando = null;
        this.indiceSeccionEditando = -1;
      }
    }
  }

  // ===== GESTIÓN DE ÍTEMS =====
  agregarNuevoItem(): void {
    if (!this.seccionEditando) {
      alert('Por favor seleccione una sección primero');
      return;
    }
    
    this.itemEditando = null;
    this.indiceItemEditando = -1;
    this.limpiarFormularioItem();
  }

  editarItem(indiceSeccion: number, indiceItem: number): void {
    const item = this.plantillaActual.secciones[indiceSeccion].items[indiceItem];
    this.itemEditando = item;
    this.indiceItemEditando = indiceItem;
    this.indiceSeccionEditando = indiceSeccion;
    this.seccionEditando = this.plantillaActual.secciones[indiceSeccion];

    // Llenar formulario
    this.formEditarItem.patchValue({
      descripcion: item.descripcion,
      descripcionDetallada: item.descripcionDetallada || '',
      tipoValidacion: item.tipoValidacion,
      comportamiento: item.comportamiento,
      esObligatorio: item.esObligatorio ? 'si' : 'no'
    });

    // Aplicar configuración específica
    this.aplicarConfiguracionItem(item.configuracion);
  }

  eliminarItem(indiceSeccion: number, indiceItem: number): void {
    if (confirm('¿Está seguro de que desea eliminar este ítem?')) {
      this.plantillaActual.secciones[indiceSeccion].items.splice(indiceItem, 1);
    }
  }

  onSubmitItem(): void {
    if (!this.seccionEditando) {
      alert('Por favor seleccione una sección primero');
      return;
    }

    if (this.formEditarItem.invalid) {
      return;
    }

    const formValue = this.formEditarItem.value;
    const configuracion = this.obtenerConfiguracionItem();
    
    
    const item: ChecklistItem = {
      id: this.itemEditando?.id || this.generarId(),
      descripcion: formValue.descripcion,
      descripcionDetallada: formValue.descripcionDetallada || null,
      tipoValidacion: formValue.tipoValidacion as ValidationType,
      comportamiento: formValue.comportamiento as ValidationBehavior,
      esObligatorio: formValue.esObligatorio === 'si',
      configuracion: configuracion,
      orden: this.itemEditando?.orden || 0
    };
    

    if (this.indiceItemEditando >= 0) {
      // Actualizar ítem existente
      this.plantillaActual.secciones[this.indiceSeccionEditando].items[this.indiceItemEditando] = item;
    } else {
      // Agregar nuevo ítem
      this.plantillaActual.secciones[this.indiceSeccionEditando].items.push(item);
    }

    this.limpiarFormularioItem();
  }

  cancelarEdicionItem(): void {
    this.limpiarFormularioItem();
  }

  private limpiarFormularioItem(): void {
    this.formEditarItem.reset({
      tipoValidacion: 'si_no_na',
      comportamiento: 'genera_error',
      esObligatorio: 'si'
    });
    this.valoresErrorSeleccionados = [];
    this.formConfiguracionMinMax.reset({
      valorMinimo: undefined,
      valorMaximo: undefined,
      generarErrorFueraRango: true
    });
    this.itemEditando = null;
    this.indiceItemEditando = -1;
  }

  private obtenerConfiguracionItem(): ValidationConfig {
    const tipo = this.formEditarItem.get('tipoValidacion')?.value;
    const config: ValidationConfig = {};


    if (tipo === 'si_no' || tipo === 'si_no_na' || tipo === 'bueno_regular_malo') {
      config.valoresError = [...this.valoresErrorSeleccionados];
    } else if (tipo === 'valor_min_max' || tipo === 'cantidad') {
      const minMaxValues = this.formConfiguracionMinMax.value;
      config.valorMinimo = minMaxValues.valorMinimo;
      config.valorMaximo = minMaxValues.valorMaximo;
      config.generarErrorFueraRango = minMaxValues.generarErrorFueraRango;
    } else if (tipo === 'personalizado') {
      // Aquí se manejarían las opciones personalizadas
      config.opcionesPersonalizadas = [];
      config.valoresError = [...this.valoresErrorSeleccionados];
    }

    return config;
  }

  private aplicarConfiguracionItem(config: ValidationConfig): void {
    if (!config) return;


    if (config.valoresError) {
      this.valoresErrorSeleccionados = [...config.valoresError];
    }

    // Aplicar configuración Min/Max
    this.formConfiguracionMinMax.patchValue({
      valorMinimo: config.valorMinimo,
      valorMaximo: config.valorMaximo,
      generarErrorFueraRango: config.generarErrorFueraRango
    });
  }

  // ===== GESTIÓN DE PLANTILLAS =====
  abrirModalNuevaPlantilla(): void {
    this.mostrarModalNuevaPlantilla = true;
    this.formNuevaPlantilla.reset({
      tipo: 'personalizado'
    });
  }

  cerrarModalNuevaPlantilla(): void {
    this.mostrarModalNuevaPlantilla = false;
  }

  crearNuevaPlantilla(): void {
    if (this.formNuevaPlantilla.invalid) {
      return;
    }

    const formValue = this.formNuevaPlantilla.value;
    this.plantillaActual = {
      id: this.generarId(),
      nombre: formValue.nombre,
      descripcion: formValue.descripcion,
      version: '1.0',
      tipo: formValue.tipo,
      secciones: []
    };

    this.cerrarModalNuevaPlantilla();
  }

  private inicializarPlantillaVacia(): void {
    this.plantillaActual = {
      id: '',
      nombre: '',
      descripcion: '',
      secciones: [],
      tipo: 'vehiculo',
      version: '1.0'
    };
  }

  async guardarPlantilla(): Promise<void> {
    if (!this.plantillaActual.nombre || this.plantillaActual.nombre.trim() === '') {
      alert('Por favor ingrese un nombre para la plantilla');
      return;
    }

    if (this.plantillaActual.secciones.length === 0) {
      alert('La plantilla debe tener al menos una sección');
      return;
    }

    const totalItems = this.plantillaActual.secciones.reduce((total, seccion) => total + seccion.items.length, 0);
    if (totalItems === 0) {
      alert('La plantilla debe tener al menos un ítem');
      return;
    }

    this.cargando = true;

    try {
            const datosPlantilla: Omit<ChecklistTemplate, 'id' | 'created_at' | 'updated_at'> = {
              nombre: this.plantillaActual.nombre,
              descripcion: this.plantillaActual.descripcion,
              version: this.plantillaActual.version,
              tipo: this.plantillaActual.tipo,
              secciones: this.plantillaActual.secciones,
            };

      if (this.plantillaActual.id && this.plantillaActual.id !== '') {
        // Actualizar plantilla existente
        await this.templateService.updateTemplate(this.plantillaActual.id, datosPlantilla).pipe(take(1)).toPromise();
        alert('Plantilla actualizada correctamente');
      } else {
        // Crear nueva plantilla
        const nuevaPlantilla = await this.templateService.createTemplate(datosPlantilla).pipe(take(1)).toPromise();
        this.plantillaActual.id = nuevaPlantilla!.id;
        alert('Plantilla guardada correctamente');
      }

      // Redirigir a la página de plantillas
      this.router.navigate(['/templates']);

    } catch (error) {
      console.error('Error guardando plantilla:', error);
      alert(`Error al guardar la plantilla: ${error}`);
    } finally {
      this.cargando = false;
    }
  }


  // ===== UTILIDADES =====
  private generarId(): string {
    return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private cargarPlantillaExistente(templateId: string): void {
    this.cargando = true;
    this.templateService.getTemplateById(templateId).subscribe({
      next: (template) => {
        if (template) {
          this.plantillaActual = template;
          this.cargando = false;
        } else {
          console.error('Plantilla no encontrada');
          this.inicializarPlantillaVacia();
        }
      },
      error: (error) => {
        console.error('Error cargando plantilla:', error);
      }
    });
  }

  // ===== GETTERS PARA TEMPLATE =====
  get secciones(): ChecklistSection[] {
    return this.plantillaActual.secciones;
  }

  get totalItems(): number {
    return this.plantillaActual.secciones.reduce((total, seccion) => total + seccion.items.length, 0);
  }

  get tieneSecciones(): boolean {
    return this.plantillaActual.secciones.length > 0;
  }

  get opcionesTipoValidacion(): string[] {
    return Object.keys(this.tiposValidacion);
  }

  get opcionesComportamiento(): string[] {
    return ['genera_error', 'solo_advertencia', 'sin_validacion'];
  }

  get opcionesObligatoriedad(): string[] {
    return ['si', 'no'];
  }

  get opcionesTipoRecurso(): string[] {
    return Object.keys(this.tiposRecurso);
  }
}
