import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * Pantalla inicial del módulo Peajes (Fase 0).
 * Wizard, catálogos y plantillas se agregan por agentes 02/03/05.
 */
@Component({
  selector: 'app-peajes-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './peajes-home.component.html',
  styleUrl: './peajes-home.component.css',
})
export class PeajesHomeComponent {}
