import { Component, Input } from '@angular/core';

export type StepperItemState = 'pending' | 'completed' | 'loading' | 'review';

/** Paso del navegador. No renderiza contenido: el panel hermano lo hace. */
@Component({
  selector: 'app-stepper-item',
  standalone: true,
  template: '',
  styles: [':host { display: none; }'],
})
export class StepperItemComponent {
  @Input({ required: true }) step = 1;
  @Input() title = '';
  @Input() state: StepperItemState = 'pending';
  @Input() disabled = false;
}
