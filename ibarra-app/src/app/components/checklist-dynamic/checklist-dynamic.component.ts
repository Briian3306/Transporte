import { Component, OnInit, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  ChecklistTemplate, 
  ChecklistSection,
  ChecklistItem, 
  ChecklistFormData, 
  ChecklistResponse, 
  ChecklistObservation, 
  ChecklistValidationSummary,
  ValidationResult,
  ChecklistProgress
} from '../../models/checklist-template.model';
import { ChecklistDynamicService } from '../../services/checklist-dynamic.service';
import { ChecklistTemplateService } from '../../services/checklist-template.service';
import { ResourceService, RecursoSeleccion } from '../../services/resource.service';
import { Logistica } from '../../models/logistica.model';

@Component({
  selector: 'app-checklist-dynamic',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './checklist-dynamic.component.html',
  styleUrls: ['./checklist-dynamic.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChecklistDynamicComponent implements OnInit {
  @Input() templateId: string | null = null;
  
  // Estado del componente
  plantillaActual: ChecklistTemplate | null = null;
  checklistForm: FormGroup;
  respuestas: ChecklistResponse = {};
  observaciones: ChecklistObservation = {};
  validaciones: ChecklistValidationSummary = { errores: [], advertencias: [], correctos: [] };
  progreso: ChecklistProgress = { totalItems: 0, itemsCompletados: 0, porcentajeCompletado: 0, itemsFaltantes: [] };
  
  // Checklist existente
  checklistId: string | null = null;
  esFinalizado: boolean = false;
  esEnProgreso: boolean = false;
  
  // Modales
  mostrarModalCargaDatos = false;
  mostrarModalObservacion = false;
  mostrarModalDescripcion = false;
  
  // Datos para modales
  itemObservacionActual: string | null = null;
  itemDescripcionActual: { descripcion: string; detallada: string } | null = null;
  
  // Recursos disponibles
  recursosDisponibles: RecursoSeleccion[] = [];
  recursoSeleccionado: RecursoSeleccion | null = null;
  
  // Filtros
  filtroRecurso = '';
  
  // Estados de carga
  cargandoDatos = false;
  cargandoRecursos = false;
  guardando = false;
  finalizando = false;
  
  // Control de visibilidad del resumen de validaciones
  mostrarResumenValidaciones = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private checklistService: ChecklistDynamicService,
    private checklistTemplateService: ChecklistTemplateService,
    private resourceService: ResourceService,
    private cdr: ChangeDetectorRef
  ) {
    this.checklistForm = this.fb.group({
      fechaHora: [this.getCurrentDateTime(), Validators.required],
      tractor: [''],
      chofer: [''],
      semi: ['']
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.templateId = params['templateId'];
      this.checklistId = params['checklistId'] || null;
      
      if (this.checklistId) {
        // Cargar checklist existente
        this.cargarChecklistExistente(this.checklistId);
      } else {
        // Cargar plantilla nueva
        this.cargarPlantilla();
      }
    });
    
    // Configurar eventos de campos
    this.configurarEventosFormulario();
  }

  private getCurrentDateTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  private configurarEventosFormulario(): void {
    // Actualizar progreso cuando cambien los campos
    this.checklistForm.valueChanges.subscribe(() => {
      this.actualizarProgreso();
    });
  }

  private cargarPlantilla(): void {
    if (!this.templateId) {
      console.error('No se proporcionó templateId en la URL');
      return;
    }

    let plantilla: ChecklistTemplate | null = null;

    switch (this.templateId) {
      case 'diario':
        plantilla = this.checklistService.getPlantilla('diario');
        break;
      case 'parcial':
        plantilla = this.checklistService.getPlantilla('parcial');
        break;
      case 'completo':
        plantilla = this.checklistService.getPlantillaCompleta();
        break;
      default:
        // Intentar cargar plantilla personalizada desde Supabase
        this.cargarPlantillaPersonalizada(this.templateId);
        return;
    }

    if (plantilla) {
      this.cargarPlantillaSeleccionada(plantilla);
    } else {
      console.error(`No se pudo cargar la plantilla: ${this.templateId}`);
    }
  }

  private async cargarPlantillaPersonalizada(templateId: string): Promise<void> {
    try {
      // Aquí implementarías la carga de plantillas personalizadas desde Supabase
      console.log('Cargando plantilla personalizada:', templateId);
      // TODO: Implementar carga desde Supabase
      const result = await this.checklistTemplateService.getTemplateById(templateId).toPromise();
      if (result && result.secciones) {
        this.cargarPlantillaSeleccionada(result);
      } else {
        console.error(`No se encontró ninguna plantilla personalizada: ${templateId}`);
        this.cdr.detectChanges(); // Forzar detección de cambios en caso de error
      }
      console.error(`Plantilla personalizada no implementada: ${templateId}`);
    } catch (error) {
      console.error('Error cargando plantilla personalizada:', error);
      this.cdr.detectChanges(); // Forzar detección de cambios en caso de error
    }
  }

  private cargarPlantillaSeleccionada(plantilla: ChecklistTemplate): void {
    this.plantillaActual = plantilla;
    this.respuestas = {};
    this.observaciones = {};
    this.validaciones = { errores: [], advertencias: [], correctos: [] };
    this.actualizarProgreso();
    
    // Forzar detección de cambios después de cargar la plantilla
    this.cdr.detectChanges();
    
    // Cargar recursos según el tipo de template
    if (plantilla.tipo) {
      this.cargarRecursosPorTipo(plantilla.tipo);
    }
  }


  // Métodos para manejo de items
  onItemChange(itemId: string, valor: string): void {
    if (this.esFinalizado) {
      return; // No permitir cambios si está finalizado
    }
    
    const item = this.encontrarItemPorId(itemId);
    if (!item) return;

    const seccion = this.encontrarSeccionPorItemId(itemId);
    const resultadoValidacion = this.checklistService.validarItem(item, valor);
    
    this.respuestas[itemId] = {
      valor: valor,
      observacion: this.observaciones[itemId] || '',
      timestamp: new Date().toISOString(),
      // Configuración completa del item
      itemConfig: {
        id: item.id,
        descripcion: item.descripcion,
        descripcionDetallada: item.descripcionDetallada,
        tipoValidacion: item.tipoValidacion,
        comportamiento: item.comportamiento,
        esObligatorio: item.esObligatorio,
        configuracion: { ...item.configuracion },
        orden: item.orden,
        seccionId: seccion?.id,
        seccionTitulo: seccion?.titulo
      },
      // Estado de validación
      validacion: {
        tipo: resultadoValidacion.tipo,
        mensaje: resultadoValidacion.mensaje,
        timestamp: new Date().toISOString()
      },
      // Metadatos
      metadata: {
        usuario: 'usuario_actual', // TODO: Obtener del servicio de autenticación
        dispositivo: navigator.userAgent,
        versionTemplate: this.plantillaActual?.version || '1.0',
        esEdicion: false,
        timestampEdicion: new Date().toISOString()
      }
    };
    
    this.actualizarProgreso();
    this.validarItem(itemId);
    this.cdr.detectChanges(); // Forzar detección de cambios después de actualizar item
  }

  // Método para manejar cambios en inputs numéricos
  onNumericInputChange(itemId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const valor = target.value;
    this.onItemChange(itemId, valor);
  }

  // Método para manejar cambios en textarea de observaciones
  onObservacionInputChange(valor: string): void {
    this.guardarObservacion(valor);
  }

  private validarItem(itemId: string): void {
    if (!this.plantillaActual) return;

    const item = this.encontrarItemPorId(itemId);
    if (!item) return;

    const respuesta = this.respuestas[itemId];
    const valor = respuesta ? respuesta.valor : '';
    const resultado = this.checklistService.validarItem(item, valor);

    // Actualizar validaciones globales
    this.actualizarValidacionesGlobales(itemId, item.descripcion, resultado);
  }

  private actualizarValidacionesGlobales(itemId: string, descripcion: string, resultado: ValidationResult): void {
    // Remover validaciones anteriores para este item
    this.validaciones.errores = this.validaciones.errores.filter(v => v.item_id !== itemId);
    this.validaciones.advertencias = this.validaciones.advertencias.filter(v => v.item_id !== itemId);
    this.validaciones.correctos = this.validaciones.correctos.filter(v => v.item_id !== itemId);

    // Agregar nueva validación
    const errorItem = {
      item: descripcion,
      mensaje: resultado.mensaje,
      item_id: itemId
    };

    if (resultado.tipo === 'error') {
      this.validaciones.errores.push(errorItem);
    } else if (resultado.tipo === 'advertencia') {
      this.validaciones.advertencias.push(errorItem);
    } else {
      this.validaciones.correctos.push(errorItem);
    }
  }

  private actualizarProgreso(): void {
    if (!this.plantillaActual) {
      this.progreso = { totalItems: 0, itemsCompletados: 0, porcentajeCompletado: 0, itemsFaltantes: [] };
      return;
    }

    this.progreso = this.checklistService.calcularProgreso(this.plantillaActual, this.respuestas);
  }

  // Métodos para validación completa
  validarTodoChecklist(): void {
    if (!this.plantillaActual) return;

    this.validaciones = this.checklistService.validarChecklist(this.plantillaActual, this.respuestas);
    this.mostrarResumenValidaciones = true; // Mostrar el resumen después de validar
    this.cdr.detectChanges(); // Forzar detección de cambios después de validar todo
  }

  // Métodos para carga de recursos
  private cargarRecursosPorTipo(tipo: string): void {
    this.cargandoRecursos = true;
    this.cdr.detectChanges(); // Forzar detección de cambios para mostrar loading
    
    this.resourceService.cargarRecursosPorTipo(tipo as any).subscribe({
      next: (recursos) => {
        this.recursosDisponibles = recursos;
        this.cargandoRecursos = false;
        this.cdr.detectChanges(); // Forzar detección de cambios después de cargar recursos
      },
      error: (error) => {
        console.error('Error cargando recursos:', error);
        this.cargandoRecursos = false;
        this.cdr.detectChanges(); // Forzar detección de cambios en caso de error
      }
    });
  }

  // Métodos para carga de datos
  async abrirModalCargaDatos(): Promise<void> {
    this.mostrarModalCargaDatos = true;
  }

  seleccionarUnidad(unidad: Logistica): void {
    // Método legacy - mantener para compatibilidad pero sin actualizar formulario
    this.mostrarModalCargaDatos = false;
  }

  // Métodos para selección de recursos
  seleccionarRecurso(recurso: RecursoSeleccion): void {
    this.recursoSeleccionado = recurso;
    this.actualizarFormularioConRecurso(recurso);
    this.mostrarModalCargaDatos = false;
    this.cdr.detectChanges(); // Forzar detección de cambios después de seleccionar recurso
  }

  private actualizarFormularioConRecurso(recurso: RecursoSeleccion): void {
    // Actualizar el formulario según el tipo de recurso
    switch (recurso.tipo) {
      case 'vehiculo':
        this.checklistForm.patchValue({
          tractor: recurso.informacion.placa
        });
        break;
      case 'chofer':
        this.checklistForm.patchValue({
          chofer: recurso.informacion.nombre
        });
        break;
      case 'unidad':
        this.checklistForm.patchValue({
          tractor: recurso.informacion.camion_patente,
          semi: recurso.informacion.semi1_patente
        });
        break;
      case 'maquina':
        this.checklistForm.patchValue({
          tractor: recurso.informacion.nombre
        });
        break;
      case 'sector':
        this.checklistForm.patchValue({
          tractor: recurso.informacion.nombre
        });
        break;
    }
  }

  // Métodos para observaciones
  abrirModalObservacion(itemId: string, descripcion: string): void {
    this.itemObservacionActual = itemId;
    this.mostrarModalObservacion = true;
  }

  cerrarModalObservacion(): void {
    this.mostrarModalObservacion = false;
    this.itemObservacionActual = null;
  }

  guardarObservacion(observacion: string): void {
    if (!this.itemObservacionActual) return;

    if (observacion.trim()) {
      this.observaciones[this.itemObservacionActual] = observacion.trim();
      
      // Actualizar respuesta si existe
      if (this.respuestas[this.itemObservacionActual]) {
        this.respuestas[this.itemObservacionActual].observacion = observacion.trim();
        // Actualizar timestamp de edición
        this.respuestas[this.itemObservacionActual].metadata.esEdicion = true;
        this.respuestas[this.itemObservacionActual].metadata.timestampEdicion = new Date().toISOString();
      }
    } else {
      delete this.observaciones[this.itemObservacionActual];
      
      // Actualizar respuesta si existe
      if (this.respuestas[this.itemObservacionActual]) {
        this.respuestas[this.itemObservacionActual].observacion = '';
        this.respuestas[this.itemObservacionActual].metadata.esEdicion = true;
        this.respuestas[this.itemObservacionActual].metadata.timestampEdicion = new Date().toISOString();
      }
    }
    this.cdr.detectChanges(); // Forzar detección de cambios después de guardar observación
  }

  guardarObservacionYcerrar(): void {
    // Guardar la observación actual del textarea
    const textarea = document.getElementById('observacionModal') as HTMLTextAreaElement;
    if (textarea) {
      this.guardarObservacion(textarea.value);
    }
    // Cerrar el modal
    this.cerrarModalObservacion();
  }

  // Métodos para descripción detallada
  abrirModalDescripcion(item: ChecklistItem): void {
    this.itemDescripcionActual = {
      descripcion: item.descripcion,
      detallada: item.descripcionDetallada || ''
    };
    this.mostrarModalDescripcion = true;
  }

  cerrarModalDescripcion(): void {
    this.mostrarModalDescripcion = false;
    this.itemDescripcionActual = null;
  }

  // Cargar checklist existente
  async cargarChecklistExistente(checklistId: string): Promise<void> {
    try {
      const checklist = await this.checklistService.obtenerChecklist(checklistId);
      
      if (!checklist) {
        alert('No se encontró el checklist');
        this.router.navigate(['/checklist-panel']);
        return;
      }

      // Verificar si está finalizado
      this.esFinalizado = checklist.estado !== 'en_progreso';
      this.esEnProgreso = checklist.estado === 'en_progreso';
      this.checklistId = checklist.id;

      // Cargar plantilla
      if (checklist.template_id) {
        // Intentar cargar plantilla personalizada
        const template = await this.checklistTemplateService.getTemplateById(checklist.template_id).toPromise();
        if (template) {
          this.cargarPlantillaSeleccionada(template);
        } else {
          // Intentar con plantillas predefinidas
          this.templateId = checklist.template_id;
          this.cargarPlantilla();
        }
      }

      // Restaurar datos del checklist
      if (checklist.respuestas) {
        this.respuestas = checklist.respuestas as ChecklistResponse;
      }
      if (checklist.observaciones) {
        this.observaciones = checklist.observaciones as ChecklistObservation;
      }
      if (checklist.validaciones) {
        this.validaciones = checklist.validaciones as ChecklistValidationSummary;
      }

      // Restaurar información del formulario
      if (checklist.informacion) {
        const info = checklist.informacion as any;
        if (info.tipoRecurso && info.informacionRecurso) {
          // Restaurar recurso seleccionado
          const idRecurso = this.obtenerIdRecurso(info.tipoRecurso, info.informacionRecurso);
          this.recursoSeleccionado = {
            id: idRecurso,
            tipo: info.tipoRecurso,
            informacion: info.informacionRecurso,
            nombre: this.obtenerNombreRecurso(info.tipoRecurso, info.informacionRecurso)
          };
          if (this.recursoSeleccionado) {
            this.actualizarFormularioConRecurso(this.recursoSeleccionado);
          }
        }
      }

      // Restaurar fecha
      if (checklist.fecha_realizacion) {
        const fecha = new Date(checklist.fecha_realizacion);
        this.checklistForm.patchValue({
          fechaHora: fecha.toISOString().slice(0, 16)
        });
      }

      // Actualizar progreso
      this.actualizarProgreso();
      this.cdr.detectChanges();
    } catch (error: any) {
      console.error('Error cargando checklist:', error);
      alert(`Error al cargar el checklist: ${error.message}`);
      this.router.navigate(['/checklist-panel']);
    }
  }

  private obtenerIdRecurso(tipo: string, info: any): string {
    switch (tipo) {
      case 'vehiculo':
        return (info.vehiculo_id || info.id || '').toString();
      case 'chofer':
        return (info.chofer_id || info.id || '').toString();
      case 'unidad':
        return (info.logistica_id || info.id || '').toString();
      case 'maquina':
        return (info.maquina_id || info.id || '').toString();
      case 'sector':
        return (info.sector_id || info.id || '').toString();
      default:
        return (info.id || '').toString();
    }
  }

  private obtenerNombreRecurso(tipo: string, info: any): string {
    switch (tipo) {
      case 'vehiculo':
        return info.placa || '';
      case 'chofer':
        return info.nombre || '';
      case 'unidad':
        return info.numero_unidad || info.camion_patente || '';
      case 'maquina':
        return info.nombre || '';
      case 'sector':
        return info.nombre || '';
      default:
        return '';
    }
  }

  // Guardar checklist en progreso
  async guardarEnProgreso(): Promise<void> {
    if (!this.plantillaActual) {
      alert('No hay plantilla cargada');
      return;
    }

    if (this.esFinalizado) {
      alert('Este checklist ya está finalizado y no se puede editar');
      return;
    }

    // Validar campos según el tipo de template
    const validacionCampos = this.validarCamposSegunTipo();
    if (!validacionCampos.valido) {
      alert(validacionCampos.mensaje);
      return;
    }

    this.guardando = true;

    try {
      const formData: ChecklistFormData = {};
      
      // Agregar información del recurso seleccionado si existe
      if (this.recursoSeleccionado) {
        formData.informacionRecurso = this.recursoSeleccionado.informacion;
        formData.tipoRecurso = this.recursoSeleccionado.tipo;
      }
      
      // Obtener fecha del formulario o usar la actual
      const fechaHora = this.checklistForm.get('fechaHora')?.value;
      const fechaRealizacion = fechaHora ? new Date(fechaHora).toISOString() : new Date().toISOString();
      
      const checklist = await this.checklistService.guardarEnProgreso(
        this.checklistId,
        this.plantillaActual,
        formData,
        this.respuestas,
        this.observaciones,
        fechaRealizacion
      );

      this.checklistId = checklist.id;
      this.esEnProgreso = true;
      alert('Checklist guardado en progreso correctamente');
      this.cdr.detectChanges();
      
    } catch (error: any) {
      console.error('Error guardando checklist:', error);
      alert(`Error al guardar el checklist: ${error.message}`);
    } finally {
      this.guardando = false;
    }
  }

  // Finalizar checklist con validación estricta
  async finalizarChecklist(): Promise<void> {
    if (!this.plantillaActual) {
      alert('No hay plantilla cargada');
      return;
    }

    if (this.esFinalizado) {
      alert('Este checklist ya está finalizado');
      return;
    }

    // Validar campos según el tipo de template
    const validacionCampos = this.validarCamposSegunTipo();
    if (!validacionCampos.valido) {
      alert(validacionCampos.mensaje);
      return;
    }

    // Validar finalización
    const validacionFinalizacion = this.validarFinalizacion();
    if (!validacionFinalizacion.valido) {
      alert(validacionFinalizacion.mensaje);
      return;
    }

    this.finalizando = true;

    try {
      const formData: ChecklistFormData = {};
      
      // Agregar información del recurso seleccionado si existe
      if (this.recursoSeleccionado) {
        formData.informacionRecurso = this.recursoSeleccionado.informacion;
        formData.tipoRecurso = this.recursoSeleccionado.tipo;
      }
      
      // Obtener fecha del formulario o usar la actual
      const fechaHora = this.checklistForm.get('fechaHora')?.value;
      const fechaRealizacion = fechaHora ? new Date(fechaHora).toISOString() : new Date().toISOString();
      
      const resultado = await this.checklistService.finalizarChecklist(
        this.checklistId,
        this.plantillaActual,
        formData,
        this.respuestas,
        this.observaciones,
        fechaRealizacion
      );

      if (resultado.validacionExitosa) {
        this.checklistId = resultado.checklist.id;
        this.esFinalizado = true;
        this.esEnProgreso = false;
        alert(resultado.mensaje);
        this.cdr.detectChanges();
      } else {
        alert(resultado.mensaje);
      }
      
    } catch (error: any) {
      console.error('Error finalizando checklist:', error);
      alert(`Error al finalizar el checklist: ${error.message}`);
    } finally {
      this.finalizando = false;
    }
  }

  // Validar que se puede finalizar el checklist
  private validarFinalizacion(): { valido: boolean; mensaje: string } {
    if (!this.plantillaActual) {
      return { valido: false, mensaje: 'No hay plantilla cargada' };
    }

    // Validar que todos los items obligatorios estén completos
    const itemsObligatoriosFaltantes: string[] = [];
    this.plantillaActual.secciones.forEach(seccion => {
      seccion.items.forEach(item => {
        if (item.esObligatorio) {
          const respuesta = this.respuestas[item.id];
          if (!respuesta || !respuesta.valor || respuesta.valor.trim() === '') {
            itemsObligatoriosFaltantes.push(item.descripcion);
          }
        }
      });
    });

    // Validar que no haya errores
    this.validarTodoChecklist();
    const tieneErrores = this.validaciones.errores.length > 0;

    if (itemsObligatoriosFaltantes.length > 0 || tieneErrores) {
      let mensaje = 'No se puede finalizar el checklist:\n\n';
      
      if (itemsObligatoriosFaltantes.length > 0) {
        mensaje += `Items obligatorios faltantes:\n• ${itemsObligatoriosFaltantes.slice(0, 5).join('\n• ')}`;
        if (itemsObligatoriosFaltantes.length > 5) {
          mensaje += `\n... y ${itemsObligatoriosFaltantes.length - 5} más`;
        }
      }
      
      if (tieneErrores) {
        if (itemsObligatoriosFaltantes.length > 0) {
          mensaje += '\n\n';
        }
        mensaje += `Errores de validación: ${this.validaciones.errores.length}`;
        if (this.validaciones.errores.length > 0) {
          mensaje += `\n• ${this.validaciones.errores[0].item}: ${this.validaciones.errores[0].mensaje}`;
        }
      }

      return { valido: false, mensaje: mensaje };
    }

    return { valido: true, mensaje: '' };
  }

  // Método para guardar checklist (deprecado, redirige a guardarEnProgreso)
  async guardarChecklist(): Promise<void> {
    await this.guardarEnProgreso();
  }

  private validarCamposSegunTipo(): { valido: boolean; mensaje: string } {
    const formValue = this.checklistForm.value;
    
    // Validación básica: fecha siempre requerida
    if (!formValue.fechaHora) {
      return { valido: false, mensaje: 'La fecha y hora son obligatorias' };
    }

    // Validación según tipo de template - verificar si hay recurso seleccionado
    switch (this.plantillaActual?.tipo) {
      case 'vehiculo':
        if (!this.recursoSeleccionado) {
          return { valido: false, mensaje: 'Debe seleccionar un vehículo' };
        }
        break;
        
      case 'chofer':
        if (!this.recursoSeleccionado) {
          return { valido: false, mensaje: 'Debe seleccionar un chofer' };
        }
        break;
        
      case 'unidad':
        if (!this.recursoSeleccionado) {
          return { valido: false, mensaje: 'Debe seleccionar una unidad' };
        }
        break;
        
      case 'maquina':
        if (!this.recursoSeleccionado) {
          return { valido: false, mensaje: 'Debe seleccionar una máquina' };
        }
        break;
        
      case 'sector':
        if (!this.recursoSeleccionado) {
          return { valido: false, mensaje: 'Debe seleccionar un sector' };
        }
        break;
        
      default:
        // Para templates legacy o sin tipo específico, no requiere recurso específico
        break;
    }

    return { valido: true, mensaje: '' };
  }

  private verificarCompletitudChecklist(): { completado: boolean; itemsFaltantes: string[] } {
    if (!this.plantillaActual) {
      return { completado: false, itemsFaltantes: [] };
    }

    const progreso = this.checklistService.calcularProgreso(this.plantillaActual, this.respuestas);
    return {
      completado: progreso.itemsCompletados === progreso.totalItems,
      itemsFaltantes: progreso.itemsFaltantes
    };
  }

  // Métodos auxiliares
  private encontrarItemPorId(itemId: string): ChecklistItem | null {
    if (!this.plantillaActual) return null;
    
    for (const seccion of this.plantillaActual.secciones) {
      const item = seccion.items.find(i => i.id === itemId);
      if (item) return item;
    }
    return null;
  }

  private encontrarSeccionPorItemId(itemId: string): ChecklistSection | null {
    if (!this.plantillaActual) return null;
    
    for (const seccion of this.plantillaActual.secciones) {
      const item = seccion.items.find(i => i.id === itemId);
      if (item) return seccion;
    }
    return null;
  }

  // Getters para el template


  get recursosFiltrados(): RecursoSeleccion[] {
    return this.recursosDisponibles.filter(recurso => {
      const nombre = (recurso.nombre || '').toLowerCase();
      const coincideRecurso = !this.filtroRecurso || nombre.includes(this.filtroRecurso.toLowerCase());
      return coincideRecurso;
    });
  }

  get observacionActual(): string {
    return this.itemObservacionActual ? (this.observaciones[this.itemObservacionActual] || '') : '';
  }

  get tieneErrores(): boolean {
    return this.validaciones.errores.length > 0;
  }

  get tieneAdvertencias(): boolean {
    return this.validaciones.advertencias.length > 0;
  }

  get estaCompletado(): boolean {
    return this.progreso.porcentajeCompletado === 100;
  }

  getEstadoItem(itemId: string): string {
    const respuesta = this.respuestas[itemId];
    if (!respuesta || !respuesta.valor) {
      return 'estado-pendiente';
    }

    // Usar la validación almacenada en la respuesta
    if (respuesta.validacion) {
      switch (respuesta.validacion.tipo) {
        case 'error':
          return 'estado-error';
        case 'advertencia':
          return 'estado-advertencia';
        case 'correcto':
          return 'estado-correcto';
        default:
          return 'estado-pendiente';
      }
    }

    // Fallback a validación en tiempo real si no hay validación almacenada
    const item = this.encontrarItemPorId(itemId);
    if (!item) return 'estado-pendiente';

    const resultado = this.checklistService.validarItem(item, respuesta.valor);
    
    switch (resultado.tipo) {
      case 'error':
        return 'estado-error';
      case 'advertencia':
        return 'estado-advertencia';
      case 'correcto':
        return 'estado-correcto';
      default:
        return 'estado-pendiente';
    }
  }
  // Métodos para acceder a la configuración almacenada en respuestas
  getItemConfigFromResponse(itemId: string): any {
    const respuesta = this.respuestas[itemId];
    return respuesta?.itemConfig || null;
  }

  getValidationFromResponse(itemId: string): any {
    const respuesta = this.respuestas[itemId];
    return respuesta?.validacion || null;
  }

  getMetadataFromResponse(itemId: string): any {
    const respuesta = this.respuestas[itemId];
    return respuesta?.metadata || null;
  }

  // Método para verificar si una respuesta fue editada
  isResponseEdited(itemId: string): boolean {
    const respuesta = this.respuestas[itemId];
    return respuesta?.metadata?.esEdicion || false;
  }

  // Método para obtener el timestamp de la última edición
  getLastEditTimestamp(itemId: string): string | null {
    const respuesta = this.respuestas[itemId];
    return respuesta?.metadata?.timestampEdicion || respuesta?.timestamp || null;
  }

  // Método para obtener información de la sección desde la respuesta
  getSectionInfoFromResponse(itemId: string): { id: string; titulo: string } | null {
    const respuesta = this.respuestas[itemId];
    if (respuesta?.itemConfig?.seccionId && respuesta?.itemConfig?.seccionTitulo) {
      return {
        id: respuesta.itemConfig.seccionId,
        titulo: respuesta.itemConfig.seccionTitulo
      };
    }
    return null;
  }

  navigateToTemplates(): void {
    this.router.navigate(['/templates']);
  }
}

