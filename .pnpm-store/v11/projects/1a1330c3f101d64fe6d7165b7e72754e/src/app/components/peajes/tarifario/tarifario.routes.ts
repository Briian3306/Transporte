import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { PEAJES_CATALOGO_SERVICE } from '../models';
import { PEAJES_TARIFARIO_SERVICE } from '../models/tarifario.contracts';
import { PeajesCatalogoSupabaseService, PeajesTarifarioSupabaseService } from '../services';
import { TarifarioListComponent } from './tarifario-list.component';
import { TarifarioEditorComponent } from './tarifario-editor.component';

export const PEAJES_TARIFARIO_PROVIDERS: Provider[] = [
  { provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService },
  { provide: PEAJES_TARIFARIO_SERVICE, useClass: PeajesTarifarioSupabaseService },
];

export const PEAJES_TARIFARIO_ROUTES: Routes = [
  {
    path: 'tarifario',
    providers: PEAJES_TARIFARIO_PROVIDERS,
    children: [
      { path: '', component: TarifarioListComponent },
      { path: ':peajeId/:estacionId/:sentido', component: TarifarioEditorComponent },
    ],
  },
];
