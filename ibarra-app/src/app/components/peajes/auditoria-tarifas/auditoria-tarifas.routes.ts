import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { PEAJES_CATALOGO_SERVICE } from '../models';
import { PeajesCatalogoSupabaseService } from '../services';
import { AuditoriaTarifasListComponent } from './auditoria-tarifas-list.component';
import { PEAJES_AUDITORIA_TARIFAS_SERVICE } from './contracts.local';
import { AuditoriaTarifasMockService } from './mocks/auditoria-tarifas.mock';

/**
 * Providers for auditoría route.
 * TODO(F14-2): swap mock for PeajesAuditoriaTarifasSupabaseService when backend lands.
 */
export const PEAJES_AUDITORIA_TARIFAS_PROVIDERS: Provider[] = [
  { provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService },
  { provide: PEAJES_AUDITORIA_TARIFAS_SERVICE, useClass: AuditoriaTarifasMockService },
];

export const PEAJES_AUDITORIA_TARIFAS_ROUTES: Routes = [
  {
    path: 'auditoria-tarifas',
    providers: PEAJES_AUDITORIA_TARIFAS_PROVIDERS,
    children: [{ path: '', component: AuditoriaTarifasListComponent }],
  },
];
