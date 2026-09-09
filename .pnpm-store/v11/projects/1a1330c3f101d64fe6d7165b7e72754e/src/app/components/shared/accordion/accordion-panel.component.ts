import {
  Component,
  Input,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionComponent } from './accordion.component';
import { AccordionPanelStatus } from './accordion.types';

let panelSeq = 0;

/**
 * Panel expandible del ledger accordion.
 * Header proyectado con `[appAccordionHeader]`; cuerpo con `[appAccordionContent]`.
 */
@Component({
  selector: 'app-accordion-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accordion-panel.component.html',
  styleUrl: './accordion-panel.component.css',
})
export class AccordionPanelComponent implements OnInit {
  private readonly accordion = inject(AccordionComponent, { optional: true });

  /** Identificador estable del panel (p. ej. número de documento). */
  @Input({ required: true }) value!: string;

  /** Estado de validación mostrado a la izquierda del título. */
  @Input() status: AccordionPanelStatus = 'neutral';

  /** Si true, este panel inicia expandido (solo si el padre aún no controla el valor). */
  @Input() initiallyExpanded = false;

  readonly panelId = `app-acc-panel-${++panelSeq}`;
  readonly headerId = `${this.panelId}-header`;
  readonly contentId = `${this.panelId}-content`;

  ngOnInit(): void {
    if (this.initiallyExpanded && this.accordion && !this.accordion.isExpanded(this.value)) {
      this.accordion.expand(this.value);
    }
  }

  get expanded(): boolean {
    return this.accordion?.isExpanded(this.value) ?? false;
  }

  toggle(): void {
    this.accordion?.toggle(this.value);
  }

  statusLabel(): string {
    switch (this.status) {
      case 'ok':
        return 'Válido';
      case 'warn':
        return 'Con advertencias';
      case 'error':
        return 'Con errores';
      default:
        return '';
    }
  }
}
