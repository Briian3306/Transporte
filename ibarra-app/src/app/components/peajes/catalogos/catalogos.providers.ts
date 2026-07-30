import { Provider } from '@angular/core';
import { PEAJES_CATALOGO_SERVICE } from '../models';
import { PeajesCatalogoMockService } from '../wizard/mocks/peajes-catalogo.mock';
import { PEAJES_CATALOGO_PROVIDERS } from '../peajes.providers';

/** Providers reales (ruta / producción). */
export const PEAJES_CATALOGOS_PROVIDERS: Provider[] = PEAJES_CATALOGO_PROVIDERS;

/** Providers mock para unit tests de catálogos. */
export const PEAJES_CATALOGOS_MOCK_PROVIDERS: Provider[] = [
  { provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService },
];
