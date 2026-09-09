import { Routes } from '@angular/router';
import { PasadasListComponent } from './pasadas-list.component';
import { PEAJES_PASADAS_PROVIDERS } from '../peajes.providers';

export const PEAJES_PASADAS_ROUTES: Routes = [
  {
    path: 'pasadas',
    providers: PEAJES_PASADAS_PROVIDERS,
    children: [{ path: '', component: PasadasListComponent }],
  },
];
