/**
 * Re-export canónico desde models (F14-2).
 * Los imports existentes de `./contracts.local` siguen funcionando.
 */
export {
  PEAJES_AUDITORIA_TARIFAS_SERVICE,
  type PeajesAuditoriaTarifasService,
  type TarifaAsignacion,
  type TarifaDiagnostico,
  type TarifaFamilia,
  type TarifaGrupoSimilar,
  type TarifaNormalizadaRow,
  type TarifaStatusCatalogo,
  type TarifaStatusTipoMeta,
  type TarifasNormalizadasFilters,
  type TarifasNormalizadasListParams,
  type TarifasNormalizadasListResult,
} from '../models/auditoria-tarifas.contracts';
