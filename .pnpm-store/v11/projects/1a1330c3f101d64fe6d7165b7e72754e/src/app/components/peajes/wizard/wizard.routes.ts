import { Routes } from '@angular/router';
import { PeajesWizardComponent } from './peajes-wizard.component';
import { PeajesCargaExpressComponent } from './carga-express/carga-express.component';
import { PEAJES_SUPABASE_PROVIDERS } from '../peajes.providers';

/**
 * Fragmento de rutas del wizard — fusionado en peajes.routes.ts (agente 05).
 * Path: /peajes/wizard
 */
export const PEAJES_WIZARD_ROUTES: Routes = [
  {
    path: 'carga-express',
    component: PeajesCargaExpressComponent,
    providers: PEAJES_SUPABASE_PROVIDERS,
  },
  {
    path: 'wizard',
    component: PeajesWizardComponent,
    providers: PEAJES_SUPABASE_PROVIDERS,
  },
];
