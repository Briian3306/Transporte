import { Injectable } from '@angular/core';
import { ChecklistItem, ValidationError } from '../models/checklist-template.model';

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  
  validateItem(item: ChecklistItem, value: string): ValidationError | null {
    // Validar obligatoriedad
    if (item.esObligatorio && (!value || value.trim() === '')) {
      return {
        item: item.descripcion,
        mensaje: 'Este campo es obligatorio',
        item_id: item.id
      };
    }

    // Validar valores que generan error
    if (item.configuracion.valoresError?.includes(value)) {
      return {
        item: item.descripcion,
        mensaje: `El valor "${value}" genera un error`,
        item_id: item.id
      };
    }

    // Validar rango para valores numéricos
    if (item.tipoValidacion === 'valor_min_max' || item.tipoValidacion === 'cantidad') {
      const valorNumerico = parseFloat(value);
      if (!isNaN(valorNumerico)) {
        const { valorMinimo, valorMaximo, generarErrorFueraRango } = item.configuracion;
        
        if (generarErrorFueraRango) {
          if (valorMinimo !== undefined && valorMinimo !== null && valorNumerico < valorMinimo) {
            return {
              item: item.descripcion,
              mensaje: `El valor ${valorNumerico} está por debajo del mínimo (${valorMinimo})`,
              item_id: item.id
            };
          }
          if (valorMaximo !== undefined && valorMaximo !== null && valorNumerico > valorMaximo) {
            return {
              item: item.descripcion,
              mensaje: `El valor ${valorNumerico} está por encima del máximo (${valorMaximo})`,
              item_id: item.id
            };
          }
        }
      }
    }

    return null;
  }

  validateChecklist(items: ChecklistItem[], responses: { [key: string]: string }): {
    errores: ValidationError[];
    advertencias: ValidationError[];
    correctos: ValidationError[];
  } {
    const errores: ValidationError[] = [];
    const advertencias: ValidationError[] = [];
    const correctos: ValidationError[] = [];

    items.forEach(item => {
      const value = responses[item.id] || '';
      const validation = this.validateItem(item, value);
      
      if (validation) {
        if (item.comportamiento === 'genera_error') {
          errores.push(validation);
        } else if (item.comportamiento === 'solo_advertencia') {
          advertencias.push(validation);
        }
      } else {
        correctos.push({
          item: item.descripcion,
          mensaje: 'Valor válido',
          item_id: item.id
        });
      }
    });

    return { errores, advertencias, correctos };
  }
}
