export interface ChecklistItemError {
  id: string;
  checklist_id: string;
  item_id: string;
  item_descripcion: string;
  tipo_error: 'error' | 'advertencia';
  mensaje_error: string;
  valor_ingresado?: string;
  valor_esperado?: string;
  seccion?: string;
  created_at: string;
}
