import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface CatalogoCard {
  route: string;
  icon: string;
  title: string;
  description: string;
}

export const CATALOGOS_CARDS: CatalogoCard[] = [
  {
    route: 'empresas',
    icon: 'fa-building',
    title: 'Empresas',
    description: 'Proveedores / concesionarias que agrupan peajes y plantillas.',
  },
  {
    route: 'peajes',
    icon: 'fa-road',
    title: 'Peajes',
    description: 'Alta y edición del catálogo de peajes.',
  },
  {
    route: 'estaciones',
    icon: 'fa-map-pin',
    title: 'Estaciones',
    description: 'Estaciones por peaje y códigos de proveedor.',
  },
  {
    route: 'patentes',
    icon: 'fa-car',
    title: 'Patentes',
    description: 'Dominios / patentes y categoría interna.',
  },
  {
    route: 'pases',
    icon: 'fa-id-card',
    title: 'Pases',
    description: 'Dispositivos / pases asociados a patentes.',
  },
];

@Component({
  selector: 'app-peajes-catalogos-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './peajes-catalogos-home.component.html',
  styleUrl: './peajes-catalogos-home.component.css',
})
export class PeajesCatalogosHomeComponent {
  readonly cards = CATALOGOS_CARDS;
}
