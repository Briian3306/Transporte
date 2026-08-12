import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { PEAJES_CATALOGO_SERVICE } from '../models';
import { PEAJES_AUDITORIA_TARIFAS_SERVICE } from '../models/auditoria-tarifas.contracts';
import { PeajesCatalogoSupabaseService, PeajesAuditoriaTarifasSupabaseService } from '../services';
import { AuditoriaTarifasListComponent } from './auditoria-tarifas-list.component';

/** Providers for auditoría route — Supabase real (F14-2). */
export const PEAJES_AUDITORIA_TARIFAS_PROVIDERS: Provider[] = [
  { provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService },
  { provide: PEAJES_AUDITORIA_TARIFAS_SERVICE, useClass: PeajesAuditoriaTarifasSupabaseService },
];

export const PEAJES_AUDITORIA_TARIFAS_ROUTES: Routes = [
  {
    path: 'auditoria-tarifas',
    providers: PEAJES_AUDITORIA_TARIFAS_PROVIDERS,
    children: [{ path: '', component: AuditoriaTarifasListComponent }],
  },
];
