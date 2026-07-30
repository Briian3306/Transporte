import { Provider } from '@angular/core';
import { PEAJES_CATALOGO_SERVICE } from '../models';
import { PeajesCatalogoMockService } from '../wizard/mocks/peajes-catalogo.mock';

/** Providers mock de catálogo hasta que agente 01 entregue el servicio real. */
export const PEAJES_CATALOGOS_MOCK_PROVIDERS: Provider[] = [
  { provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService },
];
