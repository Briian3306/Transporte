import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { 
  ChecklistTemplate, 
  ChecklistFormData, 
  ChecklistResponse, 
  ChecklistObservation, 
  ChecklistValidationSummary,
  ValidationResult,
  ChecklistProgress,
  ChecklistItem
} from '../models/checklist-template.model';
import { Checklist } from '../models/checklist.model';

@Injectable({
  providedIn: 'root'
})
export class ChecklistDynamicService {
  
  constructor(private supabaseService: SupabaseService) {}

  // Plantillas predefinidas
  private readonly plantillasPredefinidas: { [key: string]: ChecklistTemplate } = {
    diario: {
      id: 'inspeccion_diaria',
      nombre: 'Inspección Vehicular Diaria',
      descripcion: 'Checklist para inspección diaria de vehículos - Secciones 1, 2, 3 y 4',
      secciones: [
        {
          id: 'sistema_electrico',
          titulo: '1. SISTEMA ELÉCTRICO',
          items: [
            {
              id: 'luces_completo',
              descripcion: 'Control de Luces completo',
              descripcionDetallada: 'Verificar el funcionamiento de todas las luces del vehículo:\n\n• Luces de posición delanteras y traseras\n• Luces de cruce (bajas)\n• Luces de carretera (altas)\n• Luces de freno\n• Luces de giro delanteras y traseras\n• Luces de marcha atrás\n• Luces de emergencia (balizas)\n• Luces de placa patente\n\nIMPORTANTE: Todas las luces deben funcionar correctamente. Si alguna no funciona, marcar como "No" y documentar en observaciones.',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            },
            {
              id: 'limpiaparabrisas',
              descripcion: 'Limpiaparabrisas',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            },
            {
              id: 'alarma_retroceso',
              descripcion: 'Alarma de retroceso',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            },
            {
              id: 'bocina',
              descripcion: 'Bocina',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            }
          ]
        },
        {
          id: 'tractor',
          titulo: '2. TRACTOR',
          items: [
            {
              id: 'fluidos',
              descripcion: 'Fluidos',
              tipoValidacion: 'bueno_regular_malo',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['malo'] }
            },
            {
              id: 'presion_aire_freno',
              descripcion: 'Presión de aire / Sist. Freno',
              descripcionDetallada: 'Verificar la presión del sistema de frenos de aire:\n\n• Con motor en marcha, observar el manómetro de presión\n• La presión debe estar entre 80 y 120 PSI\n• Verificar que el sistema mantenga la presión sin pérdidas\n• Probar el freno de mano (válvula de emergencia)\n• Verificar que las válvulas de descarga funcionen correctamente\n\nRANGO VÁLIDO: 80 - 120 PSI\nSi la presión está fuera de rango, el vehículo NO debe circular.',
              tipoValidacion: 'valor_min_max',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valorMinimo: 80, valorMaximo: 120, generarErrorFueraRango: true }
            },
            {
              id: 'puertas_asientos',
              descripcion: 'Puertas y asientos',
              tipoValidacion: 'si_no_na',
              comportamiento: 'solo_advertencia',
              esObligatorio: false,
              configuracion: { valoresError: ['no'] }
            }
          ]
        },
        {
          id: 'semirremolque',
          titulo: '3. SEMIRREMOLQUE',
          items: [
            {
              id: 'parantes',
              descripcion: 'Parantes',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            },
            {
              id: 'barandas',
              descripcion: 'Barandas',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            },
            {
              id: 'compuerta_trasera',
              descripcion: 'Compuerta trasera',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            }
          ]
        },
        {
          id: 'general',
          titulo: '4. GENERAL',
          items: [
            {
              id: 'danos',
              descripcion: 'Daños',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['si'] }
            },
            {
              id: 'perdidas_fluidos',
              descripcion: 'Pérdidas de Fluidos',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['si'] }
            },
            {
              id: 'frenos',
              descripcion: 'Frenos',
              tipoValidacion: 'bueno_regular_malo',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['malo', 'regular'] }
            }
          ]
        }
      ]
    },
    parcial: {
      id: 'inspeccion_parcial',
      nombre: 'Inspección Parcial - Seguridad',
      descripcion: 'Checklist para inspección parcial - Secciones 5, 6 y 7',
      secciones: [
        {
          id: 'elementos_seguridad',
          titulo: '5. ELEMENTOS DE SEGURIDAD',
          items: [
            {
              id: 'extintor_semi',
              descripcion: 'Extintor semi',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            },
            {
              id: 'extintor_cabina',
              descripcion: 'Extintor Cabina',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            },
            {
              id: 'botiquin',
              descripcion: 'Botiquín de primeros auxilios',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            }
          ]
        },
        {
          id: 'elementos_epp',
          titulo: '6. ELEMENTOS DE EPP',
          items: [
            {
              id: 'casco',
              descripcion: 'Casco',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            },
            {
              id: 'calzado_seguridad',
              descripcion: 'Calzado de seguridad',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            },
            {
              id: 'chaleco_reflectivo',
              descripcion: 'Chaleco reflectivo',
              tipoValidacion: 'si_no_na',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valoresError: ['no'] }
            }
          ]
        },
        {
          id: 'elementos_cargas',
          titulo: '7. ELEMENTOS DE CARGAS',
          items: [
            {
              id: 'juego_arcos',
              descripcion: 'Juego de arcos',
              tipoValidacion: 'cantidad',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valorMinimo: 4, valorMaximo: 8, generarErrorFueraRango: true }
            },
            {
              id: 'cadenas',
              descripcion: 'Cadenas',
              tipoValidacion: 'cantidad',
              comportamiento: 'genera_error',
              esObligatorio: true,
              configuracion: { valorMinimo: 2, valorMaximo: 6, generarErrorFueraRango: true }
            },
            {
              id: 'cantoneras',
              descripcion: 'Cantoneras',
              tipoValidacion: 'cantidad',
              comportamiento: 'solo_advertencia',
              esObligatorio: false,
              configuracion: { valorMinimo: 0, valorMaximo: 20, generarErrorFueraRango: false }
            }
          ]
        }
      ]
    }
  };

  // Obtener plantilla por tipo
  getPlantilla(tipo: string): ChecklistTemplate | null {
    return this.plantillasPredefinidas[tipo] || null;
  }

  // Obtener plantilla completa (combinando diario y parcial)
  getPlantillaCompleta(): ChecklistTemplate {
    return {
      id: 'inspeccion_completa',
      nombre: 'Inspección Completa',
      descripcion: 'Checklist completo con todas las secciones',
      secciones: [
        ...this.plantillasPredefinidas['diario'].secciones,
        ...this.plantillasPredefinidas['parcial'].secciones
      ]
    };
  }

  // Obtener todas las plantillas disponibles
  getPlantillasDisponibles(): ChecklistTemplate[] {
    return [
      this.plantillasPredefinidas['diario'],
      this.plantillasPredefinidas['parcial'],
      this.getPlantillaCompleta()
    ];
  }

  // Validar un item específico
  validarItem(item: ChecklistItem, valor: string): ValidationResult {
    if (!item.configuracion || item.comportamiento === 'sin_validacion') {
      return { tipo: 'correcto', mensaje: '' };
    }

    // Validar obligatoriedad
    if (item.esObligatorio && (!valor || valor.trim() === '')) {
      return { tipo: 'error', mensaje: 'Este campo es obligatorio' };
    }

    // Validar valores que generan error
    if (item.configuracion.valoresError && item.configuracion.valoresError.includes(valor)) {
      return { 
        tipo: item.comportamiento === 'genera_error' ? 'error' : 'advertencia', 
        mensaje: `El valor "${valor}" ${item.comportamiento === 'genera_error' ? 'genera un error' : 'genera una advertencia'}` 
      };
    }

    // Validar rango para valores numéricos
    if (item.tipoValidacion === 'valor_min_max' || item.tipoValidacion === 'cantidad') {
      const valorNumerico = parseFloat(valor);
      if (!isNaN(valorNumerico)) {
        const { valorMinimo, valorMaximo, generarErrorFueraRango } = item.configuracion;
        
        if (generarErrorFueraRango) {
          if (valorMinimo !== undefined && valorMinimo !== null && valorNumerico < valorMinimo) {
            return { 
              tipo: item.comportamiento === 'genera_error' ? 'error' : 'advertencia', 
              mensaje: `El valor ${valorNumerico} está por debajo del mínimo (${valorMinimo})` 
            };
          }
          if (valorMaximo !== undefined && valorMaximo !== null && valorNumerico > valorMaximo) {
            return { 
              tipo: item.comportamiento === 'genera_error' ? 'error' : 'advertencia', 
              mensaje: `El valor ${valorNumerico} está por encima del máximo (${valorMaximo})` 
            };
          }
        }
      }
    }

    return { tipo: 'correcto', mensaje: 'Valor válido' };
  }

  // Calcular progreso del checklist
  calcularProgreso(template: ChecklistTemplate, respuestas: ChecklistResponse): ChecklistProgress {
    let totalItems = 0;
    let itemsCompletados = 0;
    const itemsFaltantes: string[] = [];

    template.secciones.forEach(seccion => {
      seccion.items.forEach(item => {
        totalItems++;
        
        const respuesta = respuestas[item.id];
        const itemCompletado = respuesta && respuesta.valor && respuesta.valor.trim() !== '';
        
        if (itemCompletado) {
          itemsCompletados++;
        } else {
          itemsFaltantes.push(item.descripcion);
        }
      });
    });

    const porcentajeCompletado = totalItems > 0 ? Math.round((itemsCompletados / totalItems) * 100) : 0;

    return {
      totalItems,
      itemsCompletados,
      porcentajeCompletado,
      itemsFaltantes
    };
  }

  // Validar todo el checklist
  validarChecklist(template: ChecklistTemplate, respuestas: ChecklistResponse): ChecklistValidationSummary {
    const validaciones: ChecklistValidationSummary = {
      errores: [],
      advertencias: [],
      correctos: []
    };

    template.secciones.forEach(seccion => {
      seccion.items.forEach(item => {
        const respuesta = respuestas[item.id];
        const valor = respuesta ? respuesta.valor : '';
        const resultado = this.validarItem(item, valor);

        const errorItem = {
          item: item.descripcion,
          mensaje: resultado.mensaje,
          item_id: item.id,
          seccion: seccion.titulo
        };

        if (resultado.tipo === 'error') {
          validaciones.errores.push(errorItem);
        } else if (resultado.tipo === 'advertencia') {
          validaciones.advertencias.push(errorItem);
        } else {
          validaciones.correctos.push(errorItem);
        }
      });
    });

    return validaciones;
  }

  // Guardar checklist en Supabase
  /**
   * @deprecated Usar guardarEnProgreso() o finalizarChecklist() en su lugar
   */
  async guardarChecklist(
    template: ChecklistTemplate,
    formData: ChecklistFormData,
    respuestas: ChecklistResponse,
    observaciones: ChecklistObservation
  ): Promise<Checklist> {
    try {
      const supabase = await this.supabaseService.getClient();
      
      // Calcular progreso y validaciones
      const progreso = this.calcularProgreso(template, respuestas);
      const validaciones = this.validarChecklist(template, respuestas);
      
      // Determinar estado del checklist
      let estado: 'completado' | 'parcial' | 'con_errores' = 'completado';
      if (progreso.itemsCompletados < progreso.totalItems) {
        estado = 'parcial';
      } else if (validaciones.errores.length > 0) {
        estado = 'con_errores';
      }

      const datosChecklist = {
        template_id: template.id,
        fecha_realizacion: new Date().toISOString(),
        informacion: formData,
        respuestas: respuestas,
        observaciones: observaciones,
        validaciones: validaciones,
        total_items: progreso.totalItems,
        items_completados: progreso.itemsCompletados,
        items_con_error: validaciones.errores.length,
        items_con_advertencia: validaciones.advertencias.length,
        items_correctos: validaciones.correctos.length,
        porcentaje_completado: progreso.porcentajeCompletado,
        estado: estado,
        requiere_revision: validaciones.errores.length > 0
      };

      const { data, error } = await supabase
        .from('checklists')
        .insert([datosChecklist])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error guardando checklist:', error);
      throw error;
    }
  }

  // Guardar checklist en progreso (permite actualizar si ya existe)
  async guardarEnProgreso(
    checklistId: string | null,
    template: ChecklistTemplate,
    formData: ChecklistFormData,
    respuestas: ChecklistResponse,
    observaciones: ChecklistObservation,
    fechaRealizacion?: string
  ): Promise<Checklist> {
    try {
      const supabase = await this.supabaseService.getClient();
      const user = await this.supabaseService.getCurrentUser();
      
      // Calcular progreso y validaciones
      const progreso = this.calcularProgreso(template, respuestas);
      const validaciones = this.validarChecklist(template, respuestas);

      const datosChecklist = {
        template_id: template.id,
        fecha_realizacion: fechaRealizacion || new Date().toISOString(), // Usar fecha proporcionada o actual
        informacion: formData,
        respuestas: respuestas,
        observaciones: observaciones,
        validaciones: validaciones,
        total_items: progreso.totalItems,
        items_completados: progreso.itemsCompletados,
        items_con_error: validaciones.errores.length,
        items_con_advertencia: validaciones.advertencias.length,
        items_correctos: validaciones.correctos.length,
        porcentaje_completado: progreso.porcentajeCompletado,
        estado: 'en_progreso' as const,
        requiere_revision: false,
        updated_by: user?.id || null
      };

      if (checklistId) {
        // Actualizar checklist existente
        const { data, error } = await supabase
          .from('checklists')
          .update(datosChecklist)
          .eq('id', checklistId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return data;
      } else {
        // Crear nuevo checklist
        const { data, error } = await supabase
          .from('checklists')
          .insert([{
            ...datosChecklist,
            created_by: user?.id || null
          }])
          .select()
          .single();

        if (error) {
          throw error;
        }

        return data;
      }
    } catch (error) {
      console.error('Error guardando checklist en progreso:', error);
      throw error;
    }
  }

  // Finalizar checklist con validación estricta
  async finalizarChecklist(
    checklistId: string | null,
    template: ChecklistTemplate,
    formData: ChecklistFormData,
    respuestas: ChecklistResponse,
    observaciones: ChecklistObservation,
    fechaRealizacion?: string
  ): Promise<{ checklist: Checklist; validacionExitosa: boolean; mensaje: string }> {
    try {
      // Validar que todos los items obligatorios estén completos
      const itemsObligatoriosFaltantes: string[] = [];
      template.secciones.forEach(seccion => {
        seccion.items.forEach(item => {
          if (item.esObligatorio) {
            const respuesta = respuestas[item.id];
            if (!respuesta || !respuesta.valor || respuesta.valor.trim() === '') {
              itemsObligatoriosFaltantes.push(item.descripcion);
            }
          }
        });
      });

      // Validar que no haya errores
      const validaciones = this.validarChecklist(template, respuestas);
      const tieneErrores = validaciones.errores.length > 0;

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
          mensaje += `Errores de validación: ${validaciones.errores.length}`;
          if (validaciones.errores.length > 0) {
            mensaje += `\n• ${validaciones.errores[0].item}: ${validaciones.errores[0].mensaje}`;
          }
        }

        return {
          checklist: null as any,
          validacionExitosa: false,
          mensaje: mensaje
        };
      }

      // Si pasa la validación, guardar como finalizado
      const supabase = await this.supabaseService.getClient();
      const user = await this.supabaseService.getCurrentUser();
      
      const progreso = this.calcularProgreso(template, respuestas);
      
      // Determinar estado final
      let estado: 'completado' | 'parcial' | 'con_errores' = 'completado';
      if (progreso.itemsCompletados < progreso.totalItems) {
        estado = 'parcial';
      } else if (validaciones.errores.length > 0) {
        estado = 'con_errores';
      }

      const datosChecklist = {
        template_id: template.id,
        fecha_realizacion: fechaRealizacion || new Date().toISOString(), // Usar fecha proporcionada o actual
        informacion: formData,
        respuestas: respuestas,
        observaciones: observaciones,
        validaciones: validaciones,
        total_items: progreso.totalItems,
        items_completados: progreso.itemsCompletados,
        items_con_error: validaciones.errores.length,
        items_con_advertencia: validaciones.advertencias.length,
        items_correctos: validaciones.correctos.length,
        porcentaje_completado: progreso.porcentajeCompletado,
        estado: estado,
        requiere_revision: validaciones.errores.length > 0,
        updated_by: user?.id || null
      };

      if (checklistId) {
        // Actualizar checklist existente
        const { data, error } = await supabase
          .from('checklists')
          .update(datosChecklist)
          .eq('id', checklistId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return {
          checklist: data,
          validacionExitosa: true,
          mensaje: 'Checklist finalizado correctamente'
        };
      } else {
        // Crear nuevo checklist finalizado
        const { data, error } = await supabase
          .from('checklists')
          .insert([{
            ...datosChecklist,
            created_by: user?.id || null
          }])
          .select()
          .single();

        if (error) {
          throw error;
        }

        return {
          checklist: data,
          validacionExitosa: true,
          mensaje: 'Checklist finalizado correctamente'
        };
      }
    } catch (error) {
      console.error('Error finalizando checklist:', error);
      throw error;
    }
  }

  // Actualizar checklist existente
  async actualizarChecklist(
    checklistId: string,
    template: ChecklistTemplate,
    formData: ChecklistFormData,
    respuestas: ChecklistResponse,
    observaciones: ChecklistObservation
  ): Promise<Checklist> {
    return this.guardarEnProgreso(checklistId, template, formData, respuestas, observaciones);
  }

  // Obtener checklists en progreso del usuario actual
  async obtenerChecklistsEnProgreso(): Promise<Checklist[]> {
    try {
      const supabase = await this.supabaseService.getClient();
      const user = await this.supabaseService.getCurrentUser();
      
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('estado', 'en_progreso')
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error obteniendo checklists en progreso:', error);
      throw error;
    }
  }

  // Obtener checklist por ID
  async obtenerChecklist(id: string): Promise<Checklist | null> {
    try {
      const supabase = await this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error obteniendo checklist:', error);
      throw error;
    }
  }

  // Obtener checklists por template
  async obtenerChecklistsPorTemplate(templateId: string): Promise<Checklist | null> {
    try {
      const supabase = await this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('template_id', templateId)
        .order('fecha_realizacion', { ascending: false });

      if (error) {
        throw error;
      }
      if (data.length === 0) {
        return null;
      }

      return data as any as Checklist;
    } catch (error) {
      console.error('Error obteniendo checklists por template:', error);
      throw error;
    }
  }
}
