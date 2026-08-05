import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-paso8-validacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paso8-validacion.component.html',
  styleUrl: './paso8-validacion.component.css',
})
export class Paso8ValidacionComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();
  @Output() irAPaso = new EventEmitter<5 | 6 | 7>();

  readonly state = inject(PeajesWizardStateService);

  resultado: ResultadoValidacionCarga | null = null;
  duplicados: ErrorValidacionPasada[] = [];
  cargando = false;
  error: string | null = null;
  diagnosticos: DiagnosticoValidacion[] = [];

  constructor(
    @Inject(PEAJES_CARGA_SERVICE) private readonly carga: PeajesCargaService,
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.validar();
  }

  async validar(): Promise<void> {
    this.cargando = true;
    this.error = null;
    try {
      const s = this.state.snapshot();
      let pasadas =
        s.pasadasEstandarizadas.length > 0
          ? s.pasadasEstandarizadas
          : this.state.construirPasadasDesdeMapeo();
      pasadas = await this.resolverReferenciasDeCatalogo(pasadas);
      this.state.setPasadasEstandarizadas(pasadas);

      const factura = this.state.facturaComoPersistible();
      const campos = this.validarCamposObligatorios(pasadas);
      const estaciones = this.validarReferencias(pasadas, 'ESTACION_ID', 'Estaciones', 6);
      const patentes = this.validarReferencias(pasadas, 'PATENTE_ID', 'Patentes', 5);
      const importe = await this.ejecutarValidacionImporte(pasadas, factura);
      const duplicados = await this.ejecutarDeteccionDuplicados(pasadas);

      this.diagnosticos = [importe.diagnostico, duplicados.diagnostico, campos, estaciones, patentes];
      this.duplicados = duplicados.errores;
      const errores = [...importe.errores, ...duplicados.errores, ...(campos.errores ?? []), ...(estaciones.errores ?? []), ...(patentes.errores ?? [])];
      this.resultado = {
        validas: importe.validas,
        errores: this.deduplicarErrores(errores),
        diferenciaFactura: importe.diferenciaFactura,
        dentroTolerancia: importe.dentroTolerancia,
      };
      this.state.setValidacion(this.resultado);
    } catch (e) {
      this.error = this.mensajeError(e);
    } finally {
      this.cargando = false;
    }
  }

  get puedeContinuar(): boolean {
    if (!this.resultado) {
      return false;
    }
    return this.resultado.errores.length === 0 && this.resultado.dentroTolerancia;
  }

  get sumaNetos(): number {
    const pasadas = this.state.snapshot().pasadasEstandarizadas;
    return pasadas.reduce((centavos, p) => {
      const importe = Number(p.IMPORTE_NETO ?? 0);
      return centavos + (Number.isFinite(importe) ? Math.round(importe * 100) : 0);
    }, 0) / 100;
  }

  continuar(): void {
    if (!this.puedeContinuar) {
      return;
    }
    this.completado.emit();
  }

  private async ejecutarValidacionImporte(
    pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>,
    factura: ReturnType<PeajesWizardStateService['facturaComoPersistible']>
  ): Promise<ResultadoDiagnosticoImporte> {
    try {
      const resultado = await firstValueFrom(this.carga.validarCarga(pasadas, factura));
      const falla = !resultado.dentroTolerancia;
      return {
        ...resultado,
        diagnostico: {
          id: 'importe', titulo: 'Importe de factura', estado: falla ? 'error' : 'ok', paso: 7,
          detalle: falla
            ? `El subtotal esperado es ${this.moneda(factura.importe_sin_iva)} y las pasadas suman ${this.moneda(this.sumarNetos(pasadas))}. Diferencia: ${this.moneda(resultado.diferenciaFactura ?? 0)} (tolerancia 1% = ${this.moneda(Math.abs(Number(factura.importe_sin_iva)) * 0.01)}).`
            : `El subtotal de la factura coincide con las pasadas dentro de la tolerancia del 1% (${this.moneda(Math.abs(Number(factura.importe_sin_iva)) * 0.01)}).`,
          accion: falla ? 'Volvé a Factura y verificá el subtotal; después revisá que el mapeo haya generado importes válidos.' : 'No requiere acción.',
          tecnico: { rpc: 'peajes_validar_factura_pasadas', request: { p_importe_sin_iva: factura.importe_sin_iva, registros: pasadas.length }, response: resultado },
        },
      };
    } catch (e) {
      return {
        validas: [], errores: [], diferenciaFactura: null, dentroTolerancia: false,
        diagnostico: this.diagnosticoError('importe', 'Importe de factura', 7, 'No se pudo contrastar el subtotal de la factura con las pasadas.', 'Verificá los importes y reintentá la validación.', 'peajes_validar_factura_pasadas', e),
      };
    }
  }

  private async ejecutarDeteccionDuplicados(pasadas: ReturnType<PeajesWizardStateService['construirPasadasDesdeMapeo']>): Promise<ResultadoDiagnosticoDuplicados> {
    const idsInvalidos = pasadas.flatMap((p, index) => this.idsRequeridos.filter((columna) => !this.esUuid(p[columna])).map((columna) => ({ fila: index + 1, columna, valor: p[columna], motivo: 'Debe ser un UUID para ejecutar la detección de duplicados.' })));
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
      return {
        errores,
        diagnostico: {
          id: 'duplicados', titulo: 'Detección de duplicados', estado: errores.length ? 'error' : 'ok', paso: 5,
          detalle: errores.length ? `Se detectaron ${errores.length} pasada(s) duplicada(s).` : 'No se detectaron pasadas duplicadas.',
          accion: errores.length ? 'Volvé a Mapeo y quitá o corregí las filas duplicadas.' : 'No requiere acción.',
          tecnico: { rpc: 'peajes_detectar_duplicados', request: { registros: pasadas.length }, response: errores },
        },
      };
    } catch (e) {
      return { errores: [], diagnostico: this.diagnosticoError('duplicados', 'Detección de duplicados', 7, 'El backend no pudo comprobar duplicados.', 'Volvé a Factura y verificá la empresa y los identificadores seleccionados.', 'peajes_detectar_duplicados', e) };
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
    if (!necesitaPases && !necesitaPatentes) return pasadas;

    const [pases, patentes] = await Promise.all([
      necesitaPases ? firstValueFrom(this.catalogo.listarPases()) : Promise.resolve([]),
      necesitaPatentes ? firstValueFrom(this.catalogo.listarPatentes()) : Promise.resolve([]),
    ]);
    const pasePorCodigo = new Map(pases.map((p) => [this.normalizarCodigo(p.pase), p.id]));
    const patentePorCodigo = new Map(patentes.map((p) => [this.normalizarCodigo(p.patente), p.id]));
    const conPatentes = pasadas.map((pasada) => ({
      ...pasada,
      PATENTE_ID: this.esUuid(pasada.PATENTE_ID) ? pasada.PATENTE_ID : (patentePorCodigo.get(this.normalizarCodigo(pasada.PATENTE_ID)) ?? pasada.PATENTE_ID),
    }));
    // Los dispositivos AUSOL son códigos del proveedor, no UUIDs. Si la
    // patente ya fue reconocida, el pase reutilizable se da de alta una sola
    // vez y se reutiliza para todas sus pasadas.
    for (const pasada of conPatentes) {
      const codigo = this.normalizarCodigo(pasada.PASE_ID);
      if (!codigo || this.esUuid(pasada.PASE_ID) || pasePorCodigo.has(codigo) || !this.esUuid(pasada.PATENTE_ID)) continue;
      const creado = await firstValueFrom(this.catalogo.crearPase({ pase: codigo, patente_id: String(pasada.PATENTE_ID) }));
      pasePorCodigo.set(codigo, creado.id);
    }
    return conPatentes.map((pasada) => ({
      ...pasada,
      PASE_ID: this.esUuid(pasada.PASE_ID) ? String(pasada.PASE_ID) : (pasePorCodigo.get(this.normalizarCodigo(pasada.PASE_ID)) ?? pasada.PASE_ID),
    }));
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
  private deduplicarErrores(errores: ErrorValidacionPasada[]): ErrorValidacionPasada[] { return errores.filter((error, index, all) => all.findIndex((otro) => otro.fila === error.fila && otro.columna === error.columna && otro.motivo === error.motivo) === index); }
  private mensajeError(error: unknown): string { return this.errorTecnico(error).message || 'Error al validar'; }
  private errorTecnico(error: unknown): { message: string; code?: string; status?: number; response?: unknown; stack?: string } { const e = error as { message?: string; code?: string; status?: number; details?: unknown; hint?: unknown; stack?: string }; return { message: e?.message ?? 'Error desconocido', code: e?.code, status: e?.status, response: { details: e?.details, hint: e?.hint }, stack: e?.stack }; }
}

type EstadoDiagnostico = 'ok' | 'warning' | 'error';
interface DiagnosticoTecnico { rpc: string; request: unknown; response: unknown; postgresCode?: string; httpStatus?: number; stack?: string; }
interface DiagnosticoValidacion { id: string; titulo: string; estado: EstadoDiagnostico; paso: 5 | 6 | 7; detalle: string; accion: string; errores?: ErrorValidacionPasada[]; tecnico?: DiagnosticoTecnico; }
interface ResultadoDiagnosticoImporte extends ResultadoValidacionCarga { diagnostico: DiagnosticoValidacion; }
interface ResultadoDiagnosticoDuplicados { errores: ErrorValidacionPasada[]; diagnostico: DiagnosticoValidacion; }
