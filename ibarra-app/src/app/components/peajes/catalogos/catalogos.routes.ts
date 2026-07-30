import { Routes } from '@angular/router';
import { PeajesCatalogosHomeComponent } from './peajes-catalogos-home.component';
import { CatalogoPeajesComponent } from './peajes/catalogo-peajes.component';
import { CatalogoEstacionesComponent } from './estaciones/catalogo-estaciones.component';
import { CatalogoPatentesComponent } from './patentes/catalogo-patentes.component';
import { CatalogoPasesComponent } from './pases/catalogo-pases.component';
import {
  PEAJES_CATALOGO_SERVICE,
} from '../models';
import { PeajesCatalogoMockService } from '../wizard/mocks/peajes-catalogo.mock';

/**
 * Fragmento de rutas de catálogos — mergear en peajes.routes.ts (agente 05).
 * Paths esperados: /peajes/catalogos, /peajes/catalogos/peajes, etc.
 */
export const PEAJES_CATALOGOS_ROUTES: Routes = [
  {
    path: 'catalogos',
    providers: [
      { provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService },
    ],
    children: [
      { path: '', component: PeajesCatalogosHomeComponent },
      { path: 'peajes', component: CatalogoPeajesComponent },
      { path: 'estaciones', component: CatalogoEstacionesComponent },
      { path: 'patentes', component: CatalogoPatentesComponent },
      { path: 'pases', component: CatalogoPasesComponent },
    ],
  },
];
