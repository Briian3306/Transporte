import { Routes } from '@angular/router';
import { PeajesCatalogosHomeComponent } from './peajes-catalogos-home.component';
import { CatalogoPeajesComponent } from './peajes/catalogo-peajes.component';
import { CatalogoEstacionesComponent } from './estaciones/catalogo-estaciones.component';
import { CatalogoPatentesComponent } from './patentes/catalogo-patentes.component';
import { CatalogoPasesComponent } from './pases/catalogo-pases.component';
import { PEAJES_CATALOGO_PROVIDERS } from '../peajes.providers';

/**
 * Fragmento de rutas de catálogos — fusionado en peajes.routes.ts (agente 05).
 * Paths: /peajes/catalogos, /peajes/catalogos/peajes, etc.
 */
export const PEAJES_CATALOGOS_ROUTES: Routes = [
  {
    path: 'catalogos',
    providers: PEAJES_CATALOGO_PROVIDERS,
    children: [
      { path: '', component: PeajesCatalogosHomeComponent },
      { path: 'peajes', component: CatalogoPeajesComponent },
      { path: 'estaciones', component: CatalogoEstacionesComponent },
      { path: 'patentes', component: CatalogoPatentesComponent },
      { path: 'pases', component: CatalogoPasesComponent },
    ],
  },
];
