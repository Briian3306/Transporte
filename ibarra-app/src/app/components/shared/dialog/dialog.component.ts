import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Modal de catálogo / alta rápida para Peajes y pantallas operativas.
 * Contenido vía proyección: default = cuerpo; `appDialogActions` = footer.
 */
@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
})
export class DialogComponent {
  @Input() open = false;
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() description = '';
  @Input() closeLabel = 'Cerrar';
  /** Si true, click en backdrop cierra. */
  @Input() closeOnBackdrop = true;
  @Input() size: 'md' | 'lg' = 'md';

  @Output() openChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  close(): void {
    if (!this.open) return;
    this.openChange.emit(false);
    this.closed.emit();
  }

  onBackdropClick(): void {
    if (this.closeOnBackdrop) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open) {
      this.close();
    }
  }
}
