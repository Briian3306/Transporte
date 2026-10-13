import { Component, ContentChildren, EventEmitter, Input, Output, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StepperItemComponent } from './stepper-item.component';

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.css',
})
export class StepperComponent {
  @Input() value = 1;
  @Input() ariaLabel = 'Pasos';
  @Output() valueChange = new EventEmitter<number>();

  @ContentChildren(StepperItemComponent) items!: QueryList<StepperItemComponent>;

  select(step: number, disabled = false): void {
    if (disabled || step === this.value) return;
    this.value = step;
    this.valueChange.emit(step);
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    const list = this.items?.toArray() ?? [];
    if (!list.length) return;
    const key = event.key;
    if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;
    event.preventDefault();
    const nextIndex =
      key === 'Home' ? 0
      : key === 'End' ? list.length - 1
      : key === 'ArrowRight' ? Math.min(list.length - 1, index + 1)
      : Math.max(0, index - 1);
    const next = list[nextIndex];
    if (!next || next.disabled) return;
    this.select(next.step);
    const nav = (event.target as HTMLElement | null)?.closest('.app-stepper__nav');
    const buttons = nav?.querySelectorAll<HTMLButtonElement>('.app-stepper__trigger');
    buttons?.[nextIndex]?.focus();
  }
}
