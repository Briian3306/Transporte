import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StepperComponent } from './stepper.component';

@Component({
  selector: 'app-stepper-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-stepper__panel" *ngIf="active" role="tabpanel">
      <ng-content></ng-content>
    </div>
  `,
})
export class StepperPanelComponent {
  @Input({ required: true }) value = 1;
  private readonly stepper = inject(StepperComponent, { optional: true });

  get active(): boolean {
    return (this.stepper?.value ?? this.value) === this.value;
  }
}
