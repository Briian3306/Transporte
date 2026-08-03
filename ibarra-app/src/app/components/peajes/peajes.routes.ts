import { Routes } from '@angular/router';
import { PeajesHomeComponent } from './peajes-home.component';
import { PEAJES_WIZARD_ROUTES } from './wizard/wizard.routes';
import { PEAJES_CATALOGOS_ROUTES } from './catalogos/catalogos.routes';
import { PEAJES_PLANTILLAS_ROUTES } from './plantillas/plantillas.routes';
import { PEAJES_PASADAS_ROUTES } from './pasadas/pasadas.routes';
import { PEAJES_SUPABASE_PROVIDERS } from './peajes.providers';

/**
 * Rutas hijas del módulo Peajes (merge Agente 05).
 * Paths sin overlap: '' | wizard | catalogos/* | plantillas | pasadas
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
    ],
  },
];
