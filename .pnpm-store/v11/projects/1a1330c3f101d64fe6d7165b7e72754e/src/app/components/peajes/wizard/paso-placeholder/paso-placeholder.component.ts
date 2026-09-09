import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-paso-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ph">
      <h2>{{ titulo }}</h2>
      <div class="pw__alert pw__alert--info">
        <i class="fas fa-info-circle" aria-hidden="true"></i>
        {{ mensaje }}
      </div>
      <div class="pw__actions">
        <button type="button" class="pw__btn pw__btn--ghost" (click)="atras.emit()">
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Atrás
        </button>
        <button type="button" class="pw__btn pw__btn--primary" (click)="siguiente.emit()">
          Continuar
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .ph h2 {
        margin: 0 0 0.75rem;
        color: #2c3e50;
        font-size: 1.2rem;
      }
    `,
  ],
})
export class PasoPlaceholderComponent {
  @Input({ required: true }) titulo!: string;
  @Input({ required: true }) mensaje!: string;
  @Output() siguiente = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();
}
