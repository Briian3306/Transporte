import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-peajes-catalogos-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './peajes-catalogos-home.component.html',
  styleUrl: './peajes-catalogos-home.component.css',
})
export class PeajesCatalogosHomeComponent {}
