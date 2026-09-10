import { Component, EventEmitter, Inject, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmacionCargaResultado,
  Estacion,
  EstacionViaSentido,
  PasadaEstandarizada,
  Pase,
  Patente,
  PEAJES_CARGA_SERVICE,
  PEAJES_CATALOGO_SERVICE,
  PeajesCargaService,
  PeajesCatalogoService,
  TARIFA_REFRESH_SERVICE,
  TarifaRefreshService,
  TarifaRefrescoGuardada,
  asociacionDesdeResultadoRefresco,
  normalizarImportesPasada,
} from '../../models';
import {
  PeajesWizardStateService,
  WizardDocumentoGrupo,
} from '../services/peajes-wizard-state.service';
import { DialogComponent } from '../../../shared';
import { TarifaRefreshDialogComponent } from './tarifa-refresh-dialog.component';
import { TarifaValidationService, AsociacionTarifaImporte } from '../../services/tarifa-validation.service';
import { GranularPermissionService } from '../../../../services/granular-permission.service';
import {
  ResultadoDetectarRefresco,
  ResumenRefrescoTarifas,
  resumirFilasRefresco,
} from '../../models/tarifa-refresh.contracts';

const CONTEXTO_INCOMPLETO_MSG =
  'Hay pasadas sin estación o categoría numérica. Completá el contexto antes de confirmar.';

const BLOQUEANTES = new Set([
  'NEW_TARIFF',
  'AMBIGUOUS_TARIFF_MATCH',
  'STATUS_REQUIRED',
  'STATUS_AMBIGUOUS',
  'CONTEXT_INCOMPLETE',
  'DIRECTION_REQUIRED',
  'DIRECTION_CONFLICT',
]);

function sentidoPasada(pasada: PasadaEstandarizada): 'IDA' | 'VUELTA' | 'AMBAS' | null {
  const raw = String(pasada.SENTIDO ?? '').trim().toUpperCase();
  if (raw === 'IDA' || raw === 'VUELTA' || raw === 'AMBAS') return raw;
  return null;
}

function formatearVigencia(iso: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim());
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

export interface FilaResumenTarifa {
  estacionNombre: string;
  lineaCategoria: string;
  status: string;
  sentido: string;
  precioAnterior: string;
  precioNuevo: string;
  vigenteDesde: string | null;
}

@Component({
  selector: 'app-paso9-revision',
  standalone: true,
  imports: [CommonModule, DialogComponent, TarifaRefreshDialogComponent],
  templateUrl: './paso9-revision.component.html',
  styleUrl: './paso9-revision.component.css',
})
export class Paso9RevisionComponent implements OnInit {
  @Input() expressMode = false;
  @Output() atras = new EventEmitter<void>();
  @Output() reiniciar = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);

  guardando = false;
  analizando = false;
  error: string | null = null;
  resultado: ConfirmacionCargaResultado | null = null;
  resultados: ConfirmacionCargaResultado[] = [];
  erroresPorDocumento: Array<{ numero: string; error: string }> = [];
  /** Números de documentos confirmados OK (para el resumen). */
  importadosResumen: Array<{ numero: string; pasadas: number }> = [];
  exitoAbierto = false;
  refreshOpen = false;
  resumenRefresco: ResumenRefrescoTarifas | null = null;
  tarifasActualizadas: TarifaRefrescoGuardada[] = [];
  avisoAsociacion: string | null = null;

  private pases: Pase[] = [];
  private patentes: Patente[] = [];
  private estaciones: Estacion[] = [];
  private estacionesViasSentido: EstacionViaSentido[] = [];

  constructor(
    @Inject(PEAJES_CARGA_SERVICE) private readonly carga: PeajesCargaService,
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService,
    @Inject(TARIFA_REFRESH_SERVICE) private readonly refresh: TarifaRefreshService,
    private readonly tarifaValidation: TarifaValidationService,
    private readonly permissions: GranularPermissionService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const [pases, patentes, estaciones, estacionesViasSentido] = await Promise.all([
        firstValueFrom(this.catalogo.listarPases()),
        firstValueFrom(this.catalogo.listarPatentes()),
        firstValueFrom(this.catalogo.listarEstaciones()),
        firstValueFrom(this.catalogo.listarEstacionesViasSentido()),
      ]);
      this.pases = pases;
      this.patentes = patentes.filter((p) => p.activa !== false);
      this.estaciones = estaciones;
      this.estacionesViasSentido = estacionesViasSentido;
      await this.analizarTarifas();
    } catch {
      this.pases = [];
      this.patentes = [];
      this.estaciones = [];
    }
  }

  get snap() {
    return this.state.snapshot();
  }

  get esMasiva(): boolean {
    return this.snap.modoImportacion === 'masiva';
  }

  get documentosOmitidos(): WizardDocumentoGrupo[] {
    return this.state.documentosOmitidos();
  }

  get documentosIncluidos(): WizardDocumentoGrupo[] {
    const docs = this.snap.documentos;
    if (!docs?.length) {
      return [
        {
          ...this.snap.factura,
          rowIndexes: [],
          status: 'neutral' as const,
          errores: [],
          omitido: false,
        },
      ];
    }
    return this.state.documentosIncluidos(docs);
  }

  /**
   * Pasadas a previsualizar / confirmar.
   * Siempre sobre `pasadasEstandarizadas`: `doc.rowIndexes` son índices del Excel.
   * No usar `validacion.validas` (concatenación por documento de Paso 8) — rompería
   * el filtro por índice y RN-17 en `peajes_confirmar_carga`.
   */
  get pasadas() {
    const s = this.snap;
    const base = s.pasadasEstandarizadas ?? [];
    if (s.modoImportacion === 'masiva') {
      return this.state.pasadasDeDocumentosIncluidos(base);
    }
    return base;
  }

  get validas(): number {
    return this.pasadas.length;
  }

  get rechazados(): number {
    return this.snap.validacion?.errores?.length ?? 0;
  }

  get sumaNetos(): number {
    return this.pasadas.reduce((acc: number, p: PasadaEstandarizada) => acc + Number(p.IMPORTE_NETO ?? 0), 0);
  }

  get registrosConfirmados(): number {
    if (this.importadosResumen.length) {
      return this.importadosResumen.reduce((n, d) => n + d.pasadas, 0);
    }
    return this.pasadas.length;
  }

  get mensajeExito(): string {
    return `Se subieron ${this.registrosConfirmados} registros correctamente!`;
  }

  get canManageTarifas(): boolean {
    return this.permissions.hasPermission('peajes', 'manage');
  }

  get confirmationBlocked(): boolean {
    if (this.analizando || this.guardando || this.refreshOpen) return true;
    if (!this.resumenRefresco) return true;
    if (this.resumenRefresco.contextIncomplete) return true;
    return this.resumenRefresco.resultados.some((r) => BLOQUEANTES.has(r.codigo));
  }

  get dialogNeeded(): boolean {
    return (this.resumenRefresco?.resultados ?? []).some((r) =>
      ['NEW_TARIFF', 'AMBIGUOUS_TARIFF_MATCH', 'STATUS_REQUIRED', 'STATUS_AMBIGUOUS', 'DIRECTION_REQUIRED', 'DIRECTION_CONFLICT'].includes(r.codigo),
    );
  }

  get seccionVigentes(): FilaResumenTarifa[] {
    return this.filasDesdeResultados(
      (r) => r.codigo === 'CURRENT_TARIFF' && r.diagnostico !== 'CONFIRMADO',
    );
  }

  get seccionHistoricas(): FilaResumenTarifa[] {
    return this.filasDesdeResultados((r) => r.codigo === 'HISTORICAL_TARIFF_MATCH');
  }

  get seccionCorrecciones(): FilaResumenTarifa[] {
    return this.filasDesdeResultados((r) =>
      r.codigo === 'CURRENT_CATEGORY_CORRECTION' || r.codigo === 'HISTORICAL_CATEGORY_CORRECTION',
    );
  }

  get seccionRevisar(): FilaResumenTarifa[] {
    return this.filasDesdeResultados((r) => r.codigo === 'REVIEW_RECORDED');
  }

  get seccionNuevasConfirmadas(): FilaResumenTarifa[] {
    return this.tarifasActualizadas
      .filter((row) => row.diagnostico !== 'REVISAR')
      .map((row) => this.filaDesdeGuardada(row));
  }

  get seccionCambiosVigencia(): FilaResumenTarifa[] {
    return this.tarifasActualizadas
      .filter((row) => !!(row.fecha_vigencia_inicio ?? row.fechaVigenciaInicio))
      .map((row) => this.filaDesdeGuardada(row));
  }

  nombreEstacionTarifa(estacionId: string): string {
    const catalogo = this.estaciones.find((estacion) => estacion.id === estacionId);
    if (catalogo?.nombre) return catalogo.nombre;
    const candidato = this.resumenRefresco?.candidatos.find((row) => row.estacionId === estacionId);
    if (candidato?.estacionNombre) return candidato.estacionNombre;
    return '—';
  }

  async analizarTarifas(): Promise<void> {
    this.analizando = true;
    try {
      const resumen = await this.refresh.analizar({
        pasadas: this.pasadas,
        documentos: this.documentosIncluidos,
        configuraciones: this.state.toConfiguracionesPlantilla(),
        estacionesViasSentido: this.estacionesViasSentido.map((row) => ({
          codigoEstacion: row.codigo_estacion,
          via: row.via,
          sentido: row.sentido,
        })),
        estacionesCatalogo: this.estaciones.map((estacion) => ({
          estacionId: estacion.id,
          estacionNombre: estacion.nombre,
          peajeId: estacion.peaje_id,
          peajeNombre: estacion.nombre,
        })),
      });
      // The extractor intentionally does not invent a peaje identity. Once the
      // station catalogue is loaded, enrich unresolved candidates so an
      // explicit Paso 9 assignment can still be persisted safely.
      const resultados = resumen.resultados.map((row) =>
        this.aplicarDecisionPersistida(row, resumen.candidatos),
      );
      const counts = resumirFilasRefresco(resultados);
      const filasNuevasConfirmadas = this.contarFilasNuevasConfirmadas(resumen.candidatos);
      this.resumenRefresco = {
        ...resumen,
        ...counts,
        filasNuevasConfirmadas,
        filasVigentes: Math.max(0, counts.filasVigentes - filasNuevasConfirmadas),
        resultados,
      };
      // Operators may review unresolved direction candidates even though only
      // peajes:manage can persist tariff changes.
      this.refreshOpen = this.dialogNeeded;
      if (this.resumenRefresco.contextIncomplete) {
        this.error = CONTEXTO_INCOMPLETO_MSG;
      } else if (this.error === CONTEXTO_INCOMPLETO_MSG) {
        this.error = null;
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo analizar las tarifas.';
    } finally {
      this.analizando = false;
    }
  }

  onRefreshCancelled(): void {
    this.refreshOpen = false;
  }

  abrirRevisionTarifas(): void {
    if (this.dialogNeeded) this.refreshOpen = true;
  }

  async onRefreshSaved(_saved: TarifaRefrescoGuardada[]): Promise<void> {
    this.tarifasActualizadas = _saved;
    this.refreshOpen = false;
    await this.analizarTarifas();
  }

  paseExt(pasada: PasadaEstandarizada): string {
    const raw = String(pasada.PASE_ID ?? '');
    if (!raw) return '—';
    const porId = this.pases.find((p) => p.id === raw);
    if (porId) return porId.pase;
    const porCodigo = this.pases.find((p) => p.pase === raw);
    return porCodigo?.pase ?? raw;
  }

  patenteTexto(pasada: PasadaEstandarizada): string {
    const raw = String(pasada.PATENTE_ID ?? '');
    if (!raw) return '—';
    const porId = this.patentes.find((p) => p.id === raw);
    if (porId) return porId.patente;
    const porCodigo = this.patentes.find((p) => p.patente === raw);
    return porCodigo?.patente ?? raw;
  }

  estacionNombre(pasada: PasadaEstandarizada): string {
    const raw = String(pasada.ESTACION_ID ?? '');
    if (!raw) return '—';
    const porId = this.estaciones.find((e) => e.id === raw);
    if (porId) return porId.nombre;
    const porNombre = this.estaciones.find((e) => e.nombre === raw);
    return porNombre?.nombre ?? raw;
  }

  onExitoCerrado(): void {
    this.exitoAbierto = false;
    this.reiniciar.emit();
  }

  async confirmar(): Promise<void> {
    if (this.confirmationBlocked) {
      if (this.dialogNeeded) this.refreshOpen = true;
      return;
    }
    this.guardando = true;
    this.error = null;
    this.erroresPorDocumento = [];
    this.resultados = [];
    this.importadosResumen = [];
    this.exitoAbierto = false;
    try {
      const s = this.state.snapshot();
      // rowIndexes apuntan al Excel / pasadasEstandarizadas, no a validacion.validas.
      const pasadasBase = s.pasadasEstandarizadas ?? [];
      const docs = this.documentosIncluidos;

      for (const doc of docs) {
        const subset = this.state.pasadasDeDocumento(doc, pasadasBase);
        const tipo = doc.tipo ?? 'FC';
        const pasadasNorm = subset.map((p: PasadaEstandarizada) => {
          const norm = normalizarImportesPasada(tipo, {
            precio: Number(p.PRECIO),
            bonificacion: Number(p.BONIFICACION ?? 0),
            importe_neto: p.IMPORTE_NETO != null ? Number(p.IMPORTE_NETO) : undefined,
          });
          return {
            ...p,
            PRECIO: norm.precio,
            BONIFICACION: norm.bonificacion,
            IMPORTE_NETO: norm.importe_neto,
            SENTIDO: sentidoPasada(p),
          };
        });
        try {
          const res = await firstValueFrom(
            this.carga.confirmarCarga({
              documento: this.state.documentoComoPersistible(doc),
              pasadas: pasadasNorm,
              plantillaId: s.plantillaId,
              mapeos: s.mapeos,
              relacionesEstacion: s.relacionesEstacion,
              nombreArchivo: s.preview?.nombreArchivo ?? null,
              permitirDuplicados: s.permitirDuplicados,
              parametrosEfectivos: {
                archivo: s.preview?.nombreArchivo,
                totalFilas: subset.length,
                documento: doc.factura,
              },
            })
          );
          this.resultados.push(res);
          this.importadosResumen.push({
            numero: doc.factura || '(sin número)',
            pasadas: res.pasadas?.length ?? subset.length,
          });
          await this.asociarTrasConfirmacion(res, doc.rowIndexes ?? []);
        } catch (e) {
          this.erroresPorDocumento.push({
            numero: doc.factura || '(sin número)',
            error: e instanceof Error ? e.message : 'Error al confirmar',
          });
        }
      }

      if (this.resultados.length) {
        this.resultado = this.resultados[this.resultados.length - 1];
        this.state.setConfirmacion(this.resultado);
      }
      if (!this.resultados.length) {
        this.error =
          this.erroresPorDocumento.map((e) => `${e.numero}: ${e.error}`).join(' · ') ||
          'No se pudo confirmar la carga';
      } else if (this.erroresPorDocumento.length) {
        this.error = `Confirmados ${this.resultados.length}; con error: ${this.erroresPorDocumento
          .map((e) => e.numero)
          .join(', ')}`;
      } else {
        this.exitoAbierto = true;
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo confirmar la carga';
    } finally {
      this.guardando = false;
    }
  }

  private async asociarTrasConfirmacion(
    res: ConfirmacionCargaResultado,
    rowIndexes: number[],
  ): Promise<void> {
    const resultados = this.resumenRefresco?.resultados ?? [];
    const asociaciones: AsociacionTarifaImporte[] = [];
    (res.pasadas ?? []).forEach((pasada, i) => {
      const sourceIndex = rowIndexes[i] ?? i;
      const hit = resultados.find((r) => r.rowIndexes.includes(sourceIndex));
      if (!hit) return;
      const mapped = asociacionDesdeResultadoRefresco({
        codigo: hit.codigo,
        tarifaImporteId: hit.tarifaImporteId,
        categoriaProveedor: hit.categoriaProveedor,
        categoriaCalculada: hit.categoriaCalculada,
      });
      if (!mapped) return;
      asociaciones.push({
        pasada_id: pasada.id,
        tarifa_importe_id: mapped.tarifa_importe_id,
        codigo: mapped.codigo,
      });
    });
    if (!asociaciones.length) return;
    try {
      await this.tarifaValidation.asociarTrasConfirmacion(asociaciones);
    } catch {
      this.avisoAsociacion =
        'La carga se guardó, pero no se pudieron asociar las tarifas. Podés reintentar la asociación.';
    }
  }

  private aplicarDecisionPersistida(
    row: ResultadoDetectarRefresco,
    candidatos: ResumenRefrescoTarifas['candidatos'],
  ): ResultadoDetectarRefresco {
    const peajeId = row.peajeId ?? this.estaciones.find((estacion) => estacion.id === row.estacionId)?.peaje_id ?? null;
    const saved = this.tarifasActualizadas.find((item) => this.guardaCubreResultado(item, row, candidatos));
    if (!saved || !BLOQUEANTES.has(row.codigo)) {
      return { ...row, peajeId };
    }
    if (row.codigo === 'CONTEXT_INCOMPLETE' && !this.identidadPersistible(saved, row)) {
      return { ...row, peajeId };
    }
    if (saved.diagnostico === 'REVISAR') {
      return {
        ...row,
        peajeId,
        codigo: 'REVIEW_RECORDED',
        tarifaImporteId: saved.tarifa_importe_id ?? row.tarifaImporteId,
        diagnostico: 'REVISAR',
      };
    }
    if (saved.diagnostico === 'CONFIRMADO') {
      return {
        ...row,
        peajeId,
        codigo: 'CURRENT_TARIFF',
        tarifaImporteId: saved.tarifa_importe_id ?? row.tarifaImporteId,
        diagnostico: 'CONFIRMADO',
        fechaVigenciaInicio: saved.fecha_vigencia_inicio ?? saved.fechaVigenciaInicio ?? row.fechaVigenciaInicio,
      };
    }
    return { ...row, peajeId };
  }

  private identidadPersistible(
    saved: TarifaRefrescoGuardada,
    row: ResultadoDetectarRefresco,
  ): boolean {
    const estacion = saved.estacion_id || row.estacionId;
    const categoria = saved.categoria ?? row.categoria;
    return !!estacion && categoria != null;
  }

  private guardaCubreResultado(
    saved: TarifaRefrescoGuardada,
    row: ResultadoDetectarRefresco,
    candidatos: ResumenRefrescoTarifas['candidatos'],
  ): boolean {
    if (saved.candidate_id && saved.candidate_id === row.id) return true;
    const candidato = candidatos.find((item) => item.id === saved.candidate_id);
    if (candidato && candidato.rowIndexes.some((idx) => row.rowIndexes.includes(idx))) return true;
    return saved.estacion_id === row.estacionId && saved.nueva === (row.candidatePrice ?? null);
  }

  private contarFilasNuevasConfirmadas(
    candidatos: ResumenRefrescoTarifas['candidatos'],
  ): number {
    return this.tarifasActualizadas
      .filter((row) => row.diagnostico !== 'REVISAR')
      .reduce((n, row) => {
        const candidato = candidatos.find((item) => item.id === row.candidate_id);
        return n + (candidato?.rowIndexes.length ?? 1);
      }, 0);
  }

  private filasDesdeResultados(
    pred: (r: ResultadoDetectarRefresco) => boolean,
  ): FilaResumenTarifa[] {
    return (this.resumenRefresco?.resultados ?? []).filter(pred).map((row) => ({
      estacionNombre: this.nombreEstacionTarifa(row.estacionId),
      lineaCategoria: this.lineaCategoria(row.categoriaProveedor, row.categoriaCalculada, row.categoria),
      status: row.status ?? '—',
      sentido: row.sentidoAplicado ?? row.sentidoSolicitado ?? '—',
      precioAnterior: row.importeActual == null ? '—' : String(row.importeActual),
      precioNuevo: row.candidatePrice == null ? '—' : String(row.candidatePrice),
      vigenteDesde: formatearVigencia(row.fechaVigenciaInicio),
    }));
  }

  private filaDesdeGuardada(row: TarifaRefrescoGuardada): FilaResumenTarifa {
    return {
      estacionNombre: this.nombreEstacionTarifa(row.estacion_id),
      lineaCategoria: this.lineaCategoria(null, row.categoria_calculada ?? row.categoriaCalculada, row.categoria),
      status: row.status,
      sentido: row.sentido,
      precioAnterior: row.anterior == null ? '—' : String(row.anterior),
      precioNuevo: String(row.nueva),
      vigenteDesde: formatearVigencia(row.fecha_vigencia_inicio ?? row.fechaVigenciaInicio),
    };
  }

  private lineaCategoria(
    proveedor: number | null | undefined,
    calculada: number | null | undefined,
    fallback: number | null | undefined,
  ): string {
    if (proveedor != null && calculada != null) {
      return `Categoría proveedor ${proveedor} -> calculada ${calculada}`;
    }
    if (proveedor != null) return `Categoría ${proveedor}`;
    if (fallback != null) return `Categoría ${fallback}`;
    return 'Categoría —';
  }
}
