import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableComponent } from '../../../shared/data-table/data-table.component';
import { DataTableColumn } from '../../../shared/data-table/data-table.types';
import { firstValueFrom } from 'rxjs';
import {
  ErrorValidacionPasada,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_CARGA_SERVICE,
  PeajesCatalogoService,
  PeajesCargaService,
  ResultadoValidacionCarga,
} from '../../models';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { paseIdVacio, ultimoPaseIdPorPatente } from '../services/ultimo-pase-patente.helper';
import { resolvePatenteReferences } from '../services/patente-reference.helper';
import {
  CodigoResultadoTarifa,
  PasadaValidacionTarifaInput,
  ResultadoFilaValidacionTarifa,
  ResultadoValidacionTarifa,
  TarifaValidationService,
} from '../../services/tarifa-validation.service';

@Component({
  selector: 'app-paso8-validacion',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './paso8-validacion.component.html',
  styleUrl: './paso8-validacion.component.css',
})
export class Paso8ValidacionComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();
  @Output() irAPaso = new EventEmitter<5 | 6 | 7>();

  readonly state = inject(PeajesWizardStateService);
  private readonly tarifaValidation = inject(TarifaValidationService);

  resultado: ResultadoValidacionCarga | null = null;
  duplicados: ErrorValidacionPasada[] = [];
  duplicadosComparacion: DuplicateComparisonRow[] = [];
  filasTarifaVista: FilaTarifaVista[] = [];
  readonly duplicadosColumns: DataTableColumn[] = [
    { key: 'pasada', label: 'Pase', width: '14%' },
    { key: 'patente', label: 'Patente', width: '12%' },
    { key: 'fecha_hora', label: 'Fecha_Hora', width: '14%' },
    { key: 'fecha_hora_repetida', label: 'Fecha_Hora repetida', width: '14%' },
    { key: 'valor', label: 'Valor', align: 'right', width: '10%' },
    { key: 'valor_repetido', label: 'Valor repetido', align: 'right', width: '10%' },
    { key: 'file_upload_name', label: 'Archivo', width: '16%' },
    { key: 'duplicado', label: 'DUPLICADO', width: '10%' },
  ];
  cargando = false;
  error: string | null = null;
  diagnosticos: DiagnosticoValidacion[] = [];
  private patenteTextoPorId = new Map<string, string>();

  constructor(
    @Inject(PEAJES_CARGA_SERVICE) private readonly carga: PeajesCargaService,
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.resultado || this.cargando) {
      return;
    }
    await this.validar();
  }

  async validar(): Promise<void> {
    this.cargando = true;
    this.error = null;
    this.duplicadosComparacion = [];
    this.filasTarifaVista = [];
    try {
      const s = this.state.snapshot();
      let pasadas =
        s.pasadasEstandarizadas.length > 0
          ? s.pasadasEstandarizadas
          : this.state.construirPasadasDesdeMapeo();
      pasadas = await this.resolverReferenciasDeCatalogo(pasadas);
      this.state.setPasadasEstandarizadas(pasadas);

      const docsAll = s.documentos?.length ? s.documentos : [];
      const docs = this.state.documentosIncluidos(docsAll.length ? docsAll : undefined);
      // Fallback flujo simple sin grupos: usar factura como único doc incluido.
      const docsParaImporte =
        docs.length > 0
          ? docs
          : docsAll.length === 0
            ? [
                {
                  ...s.factura,
                  rowIndexes: [] as number[],
                  status: 'neutral' as const,
                  errores: [] as string[],
                  omitido: false,
                },
              ]
            : [];

      const pasadasIncluidas = this.state.pasadasDeDocumentosIncluidos(pasadas);
      const pasadasValidacion =
        s.modoImportacion === 'masiva' ? pasadasIncluidas : pasadas;

      const campos = this.validarCamposObligatorios(pasadasValidacion);
      const estaciones = this.validarReferencias(pasadasValidacion, 'ESTACION_ID', 'Estaciones', 6);
      const patentes = this.validarReferencias(pasadasValidacion, 'PATENTE_ID', 'Patentes', 5);
      const duplicados = await this.ejecutarDeteccionDuplicados(pasadasValidacion);
      this.duplicadosComparacion = this.construirComparacionesDuplicados(
        duplicados.errores,
        pasadasValidacion,
        s.preview?.nombreArchivo
      );

      const importesPorDoc = [];
      const erroresImporte = [];
      const validasAll = [];
      let dentroTodos = true;
      let diffMax: number | null = null;

      for (const doc of docsParaImporte) {
        const subset = this.state.pasadasDeDocumento(doc as never, pasadas);
        const persistible = this.state.documentoComoPersistible(doc);
        const importe = await this.ejecutarValidacionImporte(subset, persistible);
        importesPorDoc.push(importe.diagnostico);
        erroresImporte.push(
          ...importe.errores.map((e) => ({
            ...e,
            motivo: `[${doc.factura || 'documento'}] ${e.motivo}`,
          }))
        );
        validasAll.push(...importe.validas);
        if (!importe.dentroTolerancia) {
          dentroTodos = false;
        }
        if (importe.diferenciaFactura != null) {
          diffMax =
            diffMax == null
              ? Math.abs(importe.diferenciaFactura)
              : Math.max(diffMax, Math.abs(importe.diferenciaFactura));
        }
        const idx = s.documentos.findIndex((d) => d.factura === doc.factura);
        if (idx >= 0) {
          this.state.patchDocumento(idx, {
            status: importe.dentroTolerancia && importe.errores.length === 0 ? 'ok' : 'error',
            errores: importe.errores.map((e) => e.motivo),
          });
        }
      }

      const tarifas = await this.ejecutarValidacionTarifas(pasadasValidacion);

      this.diagnosticos = [
        ...importesPorDoc,
        duplicados.diagnostico,
        campos,
        estaciones,
        patentes,
        tarifas,
      ];
      this.duplicados = duplicados.errores;
      const erroresDup = this.state.permitirDuplicados
        ? []
        : duplicados.errores;
      const errores = [
        ...erroresImporte,
        ...erroresDup,
        ...(campos.errores ?? []),
        ...(estaciones.errores ?? []),
        ...(patentes.errores ?? []),
      ];
      this.resultado = {
        validas: validasAll,
        errores: this.deduplicarErrores(errores),
        diferenciaFactura: diffMax,
        dentroTolerancia: dentroTodos,
      };
      this.state.setValidacion(this.resultado);
      if (this.puedeContinuar) {
        this.completado.emit();
      }
    } catch (e) {
      this.error = this.mensajeError(e);
    } finally {
      this.cargando = false;
    }
  }

  get documentosOmitidosCount(): number {
    return this.state.documentosOmitidos().length;
  }

  get puedeContinuar(): boolean {
    if (!this.resultado) {
      return false;
    }
    return this.erroresBloqueantes.length === 0 && this.resultado.dentroTolerancia;
  }

  get erroresBloqueantes(): ErrorValidacionPasada[] {
    const errores = this.resultado?.errores ?? [];
    if (!this.state.permitirDuplicados) {
      return errores;
    }
    return errores.filter((e) => e.columna !== 'CLAVE_DUPLICADO');
  }

  get duplicadosConfirmados(): boolean {
    return this.state.permitirDuplicados && this.duplicadosComparacion.length > 0;
  }

  get sumaNetos(): number {
    const s = this.state.snapshot();
    const pasadas =
      s.modoImportacion === 'masiva'
        ? this.state.pasadasDeDocumentosIncluidos(s.pasadasEstandarizadas)
        : s.pasadasEstandarizadas;
    return pasadas.reduce((centavos, p) => {
      const importe = Number(p.IMPORTE_NETO ?? 0);
      return centavos + (Number.isFinite(importe) ? Math.round(importe * 100) : 0);
    }, 0) / 100;
  }

  /** Suma de subtotales de documentos incluidos (masiva) o el de `factura` (simple). */
  get subtotalDocumentos(): number | null {
    const s = this.state.snapshot();
    if (s.modoImportacion === 'masiva') {
      const docs = this.state.documentosIncluidos(s.documentos);
      const sum = docs.reduce((acc, d) => {
        const v = Number(d.importe_sin_iva);
        return acc + (Number.isFinite(v) ? v : 0);
      }, 0);
      return docs.length ? sum : null;
    }
    const v = Number(s.factura?.importe_sin_iva);
    return Number.isFinite(v) ? v : null;
  }

  get etiquetaSubtotal(): string {
    return this.state.snapshot().modoImportacion === 'masiva'
      ? 'Subtotal documentos'
      : 'Subtotal documento';
  }

  continuar(): void {
    if (!this.puedeContinuar) {
      return;
    }
    this.completado.emit();
  }

  private async ejecutarValidacionImporte(
    pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>,
    documento: ReturnType<PeajesWizardStateService['documentoComoPersistible']>
  ): Promise<ResultadoDiagnosticoImporte> {
    try {
      const resultado = await firstValueFrom(this.carga.validarCarga(pasadas, documento));
      const falla = !resultado.dentroTolerancia;
      const label = documento.factura ? `Documento ${documento.factura}` : 'Documento';
      return {
        ...resultado,
        diagnostico: {
          id: `importe-${documento.factura || 'doc'}`,
          titulo: `Importe · ${label}`,
          estado: falla ? 'error' : 'ok',
          paso: 7,
          detalle: falla
            ? `Se espera Σ pasadas − bonificación ≈ subtotal. Subtotal ${this.moneda(documento.importe_sin_iva)}, bonificación ${this.moneda(documento.bonificacion ?? 0)}, pasadas ${this.moneda(this.sumarNetos(pasadas))}. Diferencia: ${this.moneda(resultado.diferenciaFactura ?? 0)} (tolerancia 1% = ${this.moneda(Math.abs(Number(documento.importe_sin_iva)) * 0.01)}).`
            : `Σ pasadas − bonificación concilia con el subtotal dentro de la tolerancia del 1% (${this.moneda(Math.abs(Number(documento.importe_sin_iva)) * 0.01)}).`,
          accion: falla
            ? 'Volvé a Documentos y verificá subtotal y bonificación; después revisá que el mapeo haya generado importes válidos.'
            : 'No requiere acción.',
          tecnico: {
            rpc: 'peajes_validar_factura_pasadas',
            request: {
              p_importe_sin_iva: documento.importe_sin_iva,
              p_bonificacion: documento.bonificacion ?? 0,
              registros: pasadas.length,
              tipo: documento.tipo,
            },
            response: resultado,
          },
        },
      };
    } catch (e) {
      return {
        validas: [],
        errores: [],
        diferenciaFactura: null,
        dentroTolerancia: false,
        diagnostico: this.diagnosticoError(
          'importe',
          'Importe de documento',
          7,
          'No se pudo contrastar el subtotal del documento con las pasadas.',
          'Verificá los importes y reintentá la validación.',
          'peajes_validar_factura_pasadas',
          e
        ),
      };
    }
  }

  private async ejecutarDeteccionDuplicados(pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>): Promise<ResultadoDiagnosticoDuplicados> {
    const idsInvalidos = pasadas.flatMap((p, index) =>
      this.idsRequeridos
        .filter((columna) => !this.esUuid(p[columna]))
        .map((columna) => {
          const placa =
            columna === 'PASE_ID' && paseIdVacio(p.PASE_ID)
              ? this.patenteTextoPorId.get(String(p.PATENTE_ID))
              : null;
          return {
            fila: index + 1,
            columna,
            valor: p[columna],
            motivo: placa
              ? `${placa} no tiene pase en el catálogo.`
              : 'Debe ser un UUID para ejecutar la detección de duplicados.',
          };
        })
    );
    if (idsInvalidos.length) {
      return {
        errores: idsInvalidos,
        diagnostico: {
          id: 'duplicados', titulo: 'Detección de duplicados', estado: 'error', paso: 5,
          detalle: `No se ejecutó el RPC porque hay ${idsInvalidos.length} identificador(es) inválido(s). Por ejemplo, ${String(idsInvalidos[0].valor)} no es un UUID.`,
          accion: 'Volvé a Mapeo y resolvé patente, pase y estación con valores del catálogo; no uses el identificador numérico del proveedor.',
          tecnico: { rpc: 'peajes_detectar_duplicados', request: { registros: pasadas.length }, response: idsInvalidos, postgresCode: '22P02', httpStatus: 400 },
        },
      };
    }
    try {
      const errores = await firstValueFrom(this.carga.detectarDuplicados(pasadas));
      const consentidos = this.state.permitirDuplicados && errores.length > 0;
      return {
        errores,
        diagnostico: {
          id: 'duplicados',
          titulo: 'Detección de duplicados',
          estado: errores.length ? (consentidos ? 'warning' : 'error') : 'ok',
          paso: 5,
          detalle: errores.length
            ? consentidos
              ? `Se detectaron ${errores.length} pasada(s) duplicada(s). Quedarán marcadas con DUPLICADO = sí.`
              : `Se detectaron ${errores.length} pasada(s) duplicada(s).`
            : 'No se detectaron pasadas duplicadas.',
          accion: errores.length
            ? consentidos
              ? 'Al confirmar se insertarán con duplicado = true. La detección de la clave RN-16 no se desactiva.'
              : 'Corregí las filas o pulsá «Subir igualmente» para cargarlas marcadas como duplicadas.'
            : 'No requiere acción.',
          tecnico: { rpc: 'peajes_detectar_duplicados', request: { registros: pasadas.length }, response: errores },
        },
      };
    } catch (e) {
      return { errores: [], diagnostico: this.diagnosticoError('duplicados', 'Detección de duplicados', 7, 'El backend no pudo comprobar duplicados.', 'Volvé a Factura y verificá la empresa y los identificadores seleccionados.', 'peajes_detectar_duplicados', e) };
    }
  }

  private construirComparacionesDuplicados(
    errores: ErrorValidacionPasada[],
    pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>,
    archivoActual?: string | null
  ): DuplicateComparisonRow[] {
    const archivo = archivoActual?.trim() || '—';
    return errores
      .filter((error) => {
        const fila = Number(error.fila);
        return Number.isFinite(fila) && fila > 0 && (error.columna === 'CLAVE_DUPLICADO' || error.duplicado === true);
      })
      .map((error) => {
        const importada = pasadas[error.fila - 1];
        const patenteId = String(importada?.PATENTE_ID ?? error.patente ?? '');
        return {
          pasada: error.pase_nombre ?? importada?.PASE_ID ?? error.pasada ?? error.valor,
          patente:
            error.patente_nombre ??
            this.patenteTextoPorId.get(patenteId) ??
            importada?.PATENTE_ID ??
            '—',
          fecha_hora: error.fecha_hora ?? importada?.FECHA_HORA ?? '—',
          fecha_hora_repetida: error.fecha_hora_repetida ?? '—',
          valor: importada?.IMPORTE_NETO ?? '—',
          valor_repetido: error.valor_repetido ?? '—',
          file_upload_name: error.file_upload_name ?? archivo,
          duplicado: error.duplicado === false ? 'No' : 'Sí',
        };
      });
  }

  subirIgualmente(): void {
    if (!this.duplicadosComparacion.length) {
      return;
    }
    this.state.setPermitirDuplicados(true);
    this.diagnosticos = this.diagnosticos.map((d) =>
      d.id === 'duplicados'
        ? {
            ...d,
            estado: 'warning',
            detalle: `Se detectaron ${this.duplicadosComparacion.length} pasada(s) duplicada(s). Quedarán marcadas con DUPLICADO = sí.`,
            accion: 'Al confirmar se insertarán con duplicado = true. La detección de la clave RN-16 no se desactiva.',
          }
        : d
    );
    if (this.resultado) {
      this.resultado = {
        ...this.resultado,
        errores: this.resultado.errores.filter((e) => e.columna !== 'CLAVE_DUPLICADO'),
      };
      this.state.setValidacion(this.resultado);
    }
  }

  private validarCamposObligatorios(pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>): DiagnosticoValidacion {
    const columnas = ['FECHA_HORA', 'PASE_ID', 'PATENTE_ID', 'ESTACION_ID', 'PRECIO', 'BONIFICACION', 'QUANTITY', 'IMPORTE_NETO'] as const;
    const errores = pasadas.flatMap((p, index) => columnas.filter((columna) => p[columna] === null || p[columna] === undefined || p[columna] === '').map((columna) => ({ fila: index + 1, columna, valor: p[columna], motivo: 'Campo obligatorio vacío.' })));
    return { id: 'campos', titulo: 'Campos obligatorios', estado: errores.length ? 'error' : 'ok', paso: 5, detalle: errores.length ? `Faltan ${errores.length} valor(es) obligatorio(s) en las pasadas importadas.` : 'Todos los campos obligatorios están presentes.', accion: errores.length ? 'Volvé a Mapeo y completá las columnas indicadas.' : 'No requiere acción.', errores };
  }

  /**
   * El proveedor entrega códigos operativos (DISPOSITIVO/PATENTE), mientras que
   * pasadas usa UUIDs como claves foráneas. Se resuelven aquí justo antes de
   * validar, para no enviar por error `94891934` como si fuese un UUID.
   */
  private async resolverReferenciasDeCatalogo(
    pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>
  ): Promise<ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>> {
    const necesitaPases = pasadas.some((p) => !this.esUuid(p.PASE_ID));
    const necesitaPatentes = pasadas.some((p) => !this.esUuid(p.PATENTE_ID));
    const necesitaUltimoPase = pasadas.some((p) => paseIdVacio(p.PASE_ID));
    if (!necesitaPases && !necesitaPatentes) return pasadas;

    const [pases, patentes] = await Promise.all([
      necesitaPases ? firstValueFrom(this.catalogo.listarPases()) : Promise.resolve([]),
      necesitaPatentes || necesitaUltimoPase
        ? firstValueFrom(this.catalogo.listarPatentes())
        : Promise.resolve([]),
    ]);
    this.patenteTextoPorId = new Map(
      patentes.filter((p) => p.activa !== false).map((p) => [p.id, p.patente])
    );
    const pasePorCodigo = new Map(pases.map((p) => [this.normalizarCodigo(p.pase), p.id]));
    const patentesActivas = patentes.filter((p) => p.activa !== false);
    const ultimoPorPatente = ultimoPaseIdPorPatente(pases);
    const conPatentes = resolvePatenteReferences(pasadas, patentesActivas).rows;
    // Dispositivo del proveedor: crear pase reutilizable si la patente ya está en catálogo.
    for (const pasada of conPatentes) {
      const codigo = this.normalizarCodigo(pasada.PASE_ID);
      if (
        !codigo ||
        this.esUuid(pasada.PASE_ID) ||
        pasePorCodigo.has(codigo) ||
        !this.esUuid(pasada.PATENTE_ID)
      ) {
        continue;
      }
      const creado = await firstValueFrom(
        this.catalogo.crearPase({ pase: codigo, patente_id: String(pasada.PATENTE_ID) })
      );
      pasePorCodigo.set(codigo, creado.id);
    }
    return conPatentes.map((pasada) => {
      if (this.esUuid(pasada.PASE_ID)) {
        return { ...pasada, PASE_ID: String(pasada.PASE_ID) };
      }
      const codigo = this.normalizarCodigo(pasada.PASE_ID);
      if (codigo && pasePorCodigo.has(codigo)) {
        return { ...pasada, PASE_ID: pasePorCodigo.get(codigo)! };
      }
      if (paseIdVacio(pasada.PASE_ID) && this.esUuid(pasada.PATENTE_ID)) {
        const ultimo = ultimoPorPatente.get(String(pasada.PATENTE_ID));
        if (ultimo) {
          return { ...pasada, PASE_ID: ultimo };
        }
      }
      return { ...pasada, PASE_ID: pasada.PASE_ID };
    });
  }

  private validarReferencias(pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>, columna: 'ESTACION_ID' | 'PATENTE_ID', titulo: string, paso: 5 | 6): DiagnosticoValidacion {
    const errores = pasadas.flatMap((p, index) => !this.esUuid(p[columna]) ? [{ fila: index + 1, columna, valor: p[columna], motivo: 'La referencia debe ser un UUID del catálogo.' }] : []);
    return { id: columna, titulo, estado: errores.length ? 'error' : 'ok', paso, detalle: errores.length ? `${errores.length} ${titulo.toLowerCase()} no tienen una referencia válida del catálogo.` : `Todas las ${titulo.toLowerCase()} están reconocidas.`, accion: errores.length ? `Volvé al Paso ${paso} para resolver las referencias faltantes.` : 'No requiere acción.', errores };
  }

  private diagnosticoError(id: string, titulo: string, paso: 5 | 6 | 7, detalle: string, accion: string, rpc: string, error: unknown): DiagnosticoValidacion {
    const raw = this.errorTecnico(error);
    return { id, titulo, estado: 'error', paso, detalle: `${detalle} ${raw.message}`, accion, tecnico: { rpc, request: {}, response: raw.response, postgresCode: raw.code, httpStatus: raw.status, stack: raw.stack } };
  }

  private readonly idsRequeridos: Array<'PASE_ID' | 'PATENTE_ID' | 'ESTACION_ID'> = ['PASE_ID', 'PATENTE_ID', 'ESTACION_ID'];
  private esUuid(valor: unknown): boolean { return typeof valor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor); }
  private normalizarCodigo(valor: unknown): string { return String(valor ?? '').trim().replace(/[\s-]+/g, '').toUpperCase(); }
  private sumarNetos(pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>): number { return pasadas.reduce((total, p) => total + (Number(p.IMPORTE_NETO) || 0), 0); }
  moneda(valor: number | null | undefined): string { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor ?? 0); }
  estadoTexto(estado: EstadoDiagnostico): string { return estado === 'ok' ? 'Correcto' : estado === 'warning' ? 'Advertencia' : 'Requiere revisión'; }
  etiquetaTarifa(codigo: CodigoResultadoTarifa | string | null | undefined): string {
    return ETIQUETA_TARIFA[codigo as CodigoResultadoTarifa] ?? String(codigo ?? '—');
  }
  private deduplicarErrores(errores: ErrorValidacionPasada[]): ErrorValidacionPasada[] { return errores.filter((error, index, all) => all.findIndex((otro) => otro.fila === error.fila && otro.columna === error.columna && otro.motivo === error.motivo) === index); }
  private mensajeError(error: unknown): string { return this.errorTecnico(error).message || 'Error al validar'; }
  private errorTecnico(error: unknown): { message: string; code?: string; status?: number; response?: unknown; stack?: string } { const e = error as { message?: string; code?: string; status?: number; details?: unknown; hint?: unknown; stack?: string }; return { message: e?.message ?? 'Error desconocido', code: e?.code, status: e?.status, response: { details: e?.details, hint: e?.hint }, stack: e?.stack }; }

  private async ejecutarValidacionTarifas(
    pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>
  ): Promise<DiagnosticoValidacion> {
    const mapeadas = this.mapearPasadasTarifa(pasadas);
    const configuraciones = this.state.toConfiguracionesPlantilla();
    try {
      const resultado = await this.tarifaValidation.validarLote(mapeadas, configuraciones);
      const nombres = await this.mapaNombresEstacion();
      this.filasTarifaVista = this.presentarFilasTarifa(resultado.filas, nombres);
      return this.diagnosticoTarifas(resultado, mapeadas.length);
    } catch (e) {
      this.filasTarifaVista = [];
      return this.diagnosticoTarifasError(e, mapeadas.length);
    }
  }

  private mapearPasadasTarifa(
    pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>
  ): PasadaValidacionTarifaInput[] {
    return pasadas.map((p, idx) => {
      const extra = p as Record<string, unknown>;
      const sentidoRaw = String(extra['SENTIDO'] ?? '').trim().toUpperCase();
      const sentido =
        sentidoRaw === 'IDA' || sentidoRaw === 'VUELTA' || sentidoRaw === 'AMBAS'
          ? sentidoRaw
          : 'AMBAS';
      const neto = Number(p.IMPORTE_NETO);
      const precio = Number(p.PRECIO);
      const precioPresente =
        p.PRECIO != null && p.PRECIO !== '' && Number.isFinite(precio);
      const precio_directo = precioPresente
        ? precio
        : Number.isFinite(neto)
          ? neto
          : 0;
      const catRaw = p.CATEGORIA;
      let categoria: number | string | null = null;
      if (catRaw != null && String(catRaw).trim() !== '') {
        const n = Number(catRaw);
        categoria = Number.isFinite(n) ? n : String(catRaw);
      }
      const statusRaw = extra['STATUS'] ?? extra['ESTADO'] ?? extra['tarifa_status'];
      const status =
        statusRaw == null || String(statusRaw).trim() === '' ? undefined : String(statusRaw);
      return {
        idx,
        estacion_id: String(p.ESTACION_ID ?? ''),
        categoria,
        status,
        sentido,
        fecha_hora: p.FECHA_HORA != null ? String(p.FECHA_HORA) : null,
        precio_directo,
        pasada_id: p.PASADA_ID ?? null,
        fila: extra,
      };
    });
  }

  private diagnosticoTarifas(
    resultado: ResultadoValidacionTarifa,
    registros: number
  ): DiagnosticoValidacion {
    const filas = resultado.filas;
    const advertencias = filas.filter((f) => f.codigo !== 'AL_DIA');
    const ok = filas.length === 0 || advertencias.length === 0;
    const etiquetas = [...new Set(advertencias.map((f) => this.etiquetaTarifa(f.codigo)))];
    const detalle = filas.length === 0
      ? 'No hay pasadas para contrastar con el tarifario vigente.'
      : ok
        ? 'Todas las pasadas coinciden con la tarifa vigente (Al día).'
        : `Hay ${advertencias.length} pasada(s) con tarifa ${etiquetas.join(', ')}.`;
    return {
      id: 'tarifas',
      titulo: 'Tarifas',
      estado: ok ? 'ok' : 'warning',
      paso: 5,
      detalle,
      accion: ok
        ? 'No requiere acción.'
        : 'Podés continuar con la carga; el contraste tarifario queda como advertencia.',
      tecnico: {
        rpc: 'peajes_resolver_tarifas_actuales',
        request: { registros },
        response: resultado,
      },
    };
  }

  private diagnosticoTarifasError(error: unknown, registros: number): DiagnosticoValidacion {
    const raw = this.errorTecnico(error);
    const rpc =
      typeof (error as { rpc?: unknown })?.rpc === 'string'
        ? (error as { rpc: string }).rpc
        : 'peajes_resolver_tarifas_actuales';
    return {
      id: 'tarifas',
      titulo: 'Tarifas',
      estado: 'warning',
      paso: 5,
      detalle: `No se pudieron validar las tarifas. ${raw.message}`,
      accion: 'Podés continuar con la carga; el contraste tarifario quedó como advertencia.',
      tecnico: {
        rpc,
        request: { registros },
        response: raw.response,
        postgresCode: raw.code,
        httpStatus: raw.status,
        stack: raw.stack,
      },
    };
  }

  private presentarFilasTarifa(
    filas: ResultadoFilaValidacionTarifa[],
    nombres: Map<string, string>
  ): FilaTarifaVista[] {
    return filas.map((f) => ({
      fila: f.idx + 1,
      estacion: nombres.get(f.estacion_id) ?? f.estacion_id,
      categoria: f.categoria == null || f.categoria === '' ? '—' : String(f.categoria),
      sentidoSolicitado: String(f.sentido_solicitado ?? '—'),
      sentidoAplicado: String(f.sentido_aplicado ?? '—'),
      estado: f.status?.trim() ? f.status : '—',
      importeAuditado: this.moneda(f.importe),
      importeComparado: this.moneda(f.precio_comparado),
      errorRelativo: this.formatoErrorRelativo(f.error_relativo),
      resultado: this.etiquetaTarifa(f.codigo),
    }));
  }

  private formatoErrorRelativo(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(valor)) return '—';
    return new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 2 }).format(valor);
  }

  private async mapaNombresEstacion(): Promise<Map<string, string>> {
    const listar = this.catalogo.listarEstaciones;
    if (typeof listar !== 'function') {
      return new Map();
    }
    try {
      const estaciones = await firstValueFrom(listar.call(this.catalogo));
      return new Map((estaciones ?? []).map((e) => [e.id, e.nombre]));
    } catch {
      return new Map();
    }
  }
}

type EstadoDiagnostico = 'ok' | 'warning' | 'error';
interface DiagnosticoTecnico { rpc: string; request: unknown; response: unknown; postgresCode?: string; httpStatus?: number; stack?: string; }
interface DiagnosticoValidacion { id: string; titulo: string; estado: EstadoDiagnostico; paso: 5 | 6 | 7; detalle: string; accion: string; errores?: ErrorValidacionPasada[]; tecnico?: DiagnosticoTecnico; }
interface ResultadoDiagnosticoImporte extends ResultadoValidacionCarga { diagnostico: DiagnosticoValidacion; }
interface ResultadoDiagnosticoDuplicados { errores: ErrorValidacionPasada[]; diagnostico: DiagnosticoValidacion; }
interface DuplicateComparisonRow extends Record<string, unknown> {
  pasada: unknown;
  patente: unknown;
  fecha_hora: unknown;
  fecha_hora_repetida: unknown;
  valor: unknown;
  valor_repetido: unknown;
  file_upload_name: unknown;
  duplicado: unknown;
}
interface FilaTarifaVista {
  fila: number;
  estacion: string;
  categoria: string;
  sentidoSolicitado: string;
  sentidoAplicado: string;
  estado: string;
  importeAuditado: string;
  importeComparado: string;
  errorRelativo: string;
  resultado: string;
}
const ETIQUETA_TARIFA: Record<CodigoResultadoTarifa, string> = {
  AL_DIA: 'Al día',
  HISTORICA: 'Histórica',
  DESFASADO: 'Desfasado',
  SIN_TARIFA: 'Sin tarifa',
  CATEGORIA_PENDIENTE: 'Categoría pendiente',
  ESTADO_AMBIGUO: 'Estado ambiguo',
};
