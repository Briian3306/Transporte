import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface GraphNode {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  rightWall: number;
  leftWall: number;
  top: number;
  bottom: number;
}

const DEFAULT_MESSAGES = [
  'Analizando texto....',
  'Analizando Factura ....',
  'Leyendo importes....',
  'Buscando número y fecha....',
];

const SCALE_X = 240 / 600;
const SCALE_Y = 220 / 600;

@Component({
  selector: 'app-graph-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graph-loader.component.html',
  styleUrl: './graph-loader.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphLoaderComponent implements AfterViewInit, OnDestroy {
  @Input() messages: string[] = DEFAULT_MESSAGES;
  @Input() messageIntervalMs = 2200;
  @Input() detail = 'Podés completar el documento a mano.';

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  currentMessage = DEFAULT_MESSAGES[0];
  private messageIndex = 0;
  private rafId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private nodes: GraphNode[] = [];
  private readonly edges: [number, number][] = [
    [0, 5],
    [4, 0],
    [3, 5],
    [1, 3],
    [1, 5],
    [0, 2],
    [3, 2],
    [4, 2],
    [5, 2],
  ];

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.currentMessage = this.messages[0] ?? '';
    this.nodes = this.createNodes();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.drawFrame();
    if (!reduceMotion) {
      this.loop();
      this.intervalId = setInterval(() => this.advanceMessage(), this.messageIntervalMs);
    }
  }

  ngOnDestroy(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    } else {
      cancelAnimationFrame(0);
    }
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    } else {
      clearInterval(0);
    }
  }

  private advanceMessage(): void {
    if (this.messages.length === 0) return;
    this.messageIndex = (this.messageIndex + 1) % this.messages.length;
    this.currentMessage = this.messages[this.messageIndex];
    this.cdr.markForCheck();
  }

  private createNodes(): GraphNode[] {
    const seeds: [number, number][] = [
      [400, 275],
      [100, 250],
      [100, 450],
      [200, 375],
      [500, 300],
      [450, 450],
    ];
    return seeds.map(([x, y]) => {
      const sx = x * SCALE_X;
      const sy = y * SCALE_Y;
      return {
        x: sx,
        y: sy,
        dx: 0.35 + Math.random() * 0.45,
        dy: 0.35 + Math.random() * 0.45,
        size: 3,
        rightWall: sx + 52 * SCALE_X,
        leftWall: sx - 62 * SCALE_X,
        top: sy - 41 * SCALE_Y,
        bottom: sy + 30 * SCALE_Y,
      };
    });
  }

  private loop = (): void => {
    this.step();
    this.drawFrame();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(): void {
    for (const node of this.nodes) {
      node.x += node.dx;
      node.y += node.dy;
      if (node.x + node.size > node.rightWall || node.x - node.size < node.leftWall) {
        node.dx *= -1;
      }
      if (node.y + node.size > node.bottom || node.y - node.size < node.top) {
        node.dy *= -1;
      }
    }
  }

  private drawFrame(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d1cfcb';
    ctx.lineWidth = 2;
    for (const [a, b] of this.edges) {
      const from = this.nodes[a];
      const to = this.nodes[b];
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.fillStyle = '#8a8680';
    for (const node of this.nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
