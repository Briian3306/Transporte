import { Routes } from '@angular/router';
import { PeajesHomeComponent } from './peajes-home.component';
import { PEAJES_WIZARD_ROUTES } from './wizard/wizard.routes';
import { PEAJES_CATALOGOS_ROUTES } from './catalogos/catalogos.routes';
import { PEAJES_PLANTILLAS_ROUTES } from './plantillas/plantillas.routes';
import { PEAJES_PASADAS_ROUTES } from './pasadas/pasadas.routes';
import { PEAJES_PASADAS_PENDIENTES_ROUTES } from './pasadas-pendientes/pasadas-pendientes.routes';
import { PEAJES_AUDITORIA_TARIFAS_ROUTES } from './auditoria-tarifas/auditoria-tarifas.routes';
import { PEAJES_AUDITORIA_ESTACIONES_ROUTES } from './auditoria-estaciones/auditoria-estaciones.routes';
import { PEAJES_TARIFARIO_ROUTES } from './tarifario/tarifario.routes';
import { PEAJES_PDF_READER_ROUTES } from './pdf-reader/pdf-reader.routes';
import { PEAJES_SUPABASE_PROVIDERS } from './peajes.providers';

/**
 * Rutas hijas del módulo Peajes (merge Agente 05).
 * Paths sin overlap: '' | wizard | catalogos/* | plantillas | pasadas | pasadas-pendientes | auditoria-tarifas | tarifario
 */
export const PEAJES_ROUTES: Routes = [
  {
    path: '',
    providers: PEAJES_SUPABASE_PROVIDERS,
    children: [
      {
        path: '',
        component: PeajesHomeComponent,
      },
      ...PEAJES_WIZARD_ROUTES,
      ...PEAJES_CATALOGOS_ROUTES,
      ...PEAJES_PLANTILLAS_ROUTES,
      ...PEAJES_PASADAS_ROUTES,
      ...PEAJES_PASADAS_PENDIENTES_ROUTES,
      ...PEAJES_AUDITORIA_TARIFAS_ROUTES,
      ...PEAJES_TARIFARIO_ROUTES,
      ...PEAJES_AUDITORIA_ESTACIONES_ROUTES,
      ...PEAJES_PDF_READER_ROUTES,
    ],
  },
];
