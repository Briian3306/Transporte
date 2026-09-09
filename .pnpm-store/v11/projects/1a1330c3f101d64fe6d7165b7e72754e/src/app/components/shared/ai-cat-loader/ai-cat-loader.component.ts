import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';

const DEFAULT_MESSAGES = [
  'Analizando factura…',
  'Leyendo importes…',
  'Buscando número y fecha…',
  'Verificando IVA…',
];

@Component({
  selector: 'app-ai-cat-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-cat-loader.component.html',
  styleUrl: './ai-cat-loader.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiCatLoaderComponent implements OnInit, OnDestroy {
  @Input() messages: string[] = DEFAULT_MESSAGES;
  @Input() messageIntervalMs = 2200;

  @HostBinding('class.reduced-motion') reducedMotion = false;

  currentMessage = DEFAULT_MESSAGES[0];
  private messageIndex = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.currentMessage = this.messages[0] ?? '';
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!this.reducedMotion && this.messages.length > 1) {
      this.intervalId = setInterval(() => this.advanceMessage(), this.messageIntervalMs);
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private advanceMessage(): void {
    if (this.messages.length === 0) return;
    this.messageIndex = (this.messageIndex + 1) % this.messages.length;
    this.currentMessage = this.messages[this.messageIndex];
    this.cdr.markForCheck();
  }
}
