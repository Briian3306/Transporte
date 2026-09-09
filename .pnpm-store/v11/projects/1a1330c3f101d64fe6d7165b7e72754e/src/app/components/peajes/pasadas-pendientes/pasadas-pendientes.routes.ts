import { Routes } from '@angular/router';
import { PasadasPendientesListComponent } from './pasadas-pendientes-list.component';
import { PEAJES_PASADAS_PROVIDERS } from '../peajes.providers';

export const PEAJES_PASADAS_PENDIENTES_ROUTES: Routes = [
  {
    path: 'pasadas-pendientes',
    providers: PEAJES_PASADAS_PROVIDERS,
    children: [{ path: '', component: PasadasPendientesListComponent }],
  },
];
