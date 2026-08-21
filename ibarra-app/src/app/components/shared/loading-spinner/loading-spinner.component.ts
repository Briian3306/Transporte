import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-spinner.component.html',
  styleUrl: './loading-spinner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingSpinnerComponent {
  @Input() label = 'Cargando';
  @Input() detail = '';
  @Input() size: 'sm' | 'md' = 'md';
}
