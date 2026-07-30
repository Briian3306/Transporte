import { Provider } from '@angular/core';
import {
  PEAJES_CARGA_SERVICE,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
} from './models';
import {
  PeajesCargaSupabaseService,
  PeajesCatalogoSupabaseService,
  PeajesPlantillasSupabaseService,
} from './services';

/**
 * Providers reales (F01) para swap de mocks — Agente 05.
 * Los tres servicios son `providedIn: 'root'`; estos tokens cablean los contratos.
 */
export const PEAJES_SUPABASE_PROVIDERS: Provider[] = [
  { provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService },
  { provide: PEAJES_CARGA_SERVICE, useExisting: PeajesCargaSupabaseService },
  { provide: PEAJES_PLANTILLAS_SERVICE, useExisting: PeajesPlantillasSupabaseService },
];

export const PEAJES_CATALOGO_PROVIDERS: Provider[] = [
  { provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService },
];

export const PEAJES_PLANTILLAS_PROVIDERS: Provider[] = [
  { provide: PEAJES_PLANTILLAS_SERVICE, useExisting: PeajesPlantillasSupabaseService },
];
