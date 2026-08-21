import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { PEAJES_CATALOGO_SERVICE, PEAJES_PASADAS_SERVICE } from '../models';
import { PEAJES_AUDITORIA_ESTACIONES_SERVICE } from '../models/auditoria-estaciones.contracts';
import {
  PeajesCatalogoSupabaseService,
  PeajesPasadasSupabaseService,
  PeajesAuditoriaEstacionesSupabaseService,
} from '../services';
import { AuditoriaEstacionesListComponent } from './auditoria-estaciones-list.component';

export const PEAJES_AUDITORIA_ESTACIONES_PROVIDERS: Provider[] = [
  { provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService },
  { provide: PEAJES_PASADAS_SERVICE, useExisting: PeajesPasadasSupabaseService },
  { provide: PEAJES_AUDITORIA_ESTACIONES_SERVICE, useExisting: PeajesAuditoriaEstacionesSupabaseService },
];

export const PEAJES_AUDITORIA_ESTACIONES_ROUTES: Routes = [
  {
    path: 'auditoria-estaciones',
    providers: PEAJES_AUDITORIA_ESTACIONES_PROVIDERS,
    children: [{ path: '', component: AuditoriaEstacionesListComponent }],
  },
];
