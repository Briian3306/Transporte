import { Routes } from '@angular/router';
import { PeajesWizardComponent } from './peajes-wizard.component';
import { PEAJES_SUPABASE_PROVIDERS } from '../peajes.providers';

/**
 * Fragmento de rutas del wizard — fusionado en peajes.routes.ts (agente 05).
 * Path: /peajes/wizard
 */
export const PEAJES_WIZARD_ROUTES: Routes = [
  {
    path: 'wizard',
    component: PeajesWizardComponent,
    providers: PEAJES_SUPABASE_PROVIDERS,
  },
];
