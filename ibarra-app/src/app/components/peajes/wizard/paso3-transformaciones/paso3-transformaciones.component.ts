import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import {
  ConfiguracionPlantilla,
  ErrorValidacionPasada,
  PEAJES_PLANTILLAS_SERVICE,
  PeajesPlantillasService,
  PlantillaConfiguracion,
} from '../../models';
import { PASADA_COLUMN_KEYS } from '../../models/peajes.types';
import { PeajesMotorTransformacionService } from '../../plantillas/motor/peajes-motor-transformacion.service';
import {
  AlgorithmDescriptor,
  ParametroSchemaField,
} from '../../plantillas/motor/algorithm-descriptor';
import { FORMATOS_FECHA_HORA } from '../../plantillas/motor/strategies/estrategias-atomicas';
import {
  ConfiguracionPlantillaDraft,
  PeajesWizardStateService,
  PlantillaWizardMeta,
} from '../services/peajes-wizard-state.service';

/**
 * Paso 3 — pipeline editable (F02-10 Wave 2).
 * Consume motor APIs (getAlgorithmDescriptors, validarDependenciasPipeline, previsualizarPaso).
 */
@Component({
  selector: 'app-paso3-transformaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './paso3-transformaciones.component.html',
  styleUrl: './paso3-transformaciones.component.css',
})
export class Paso3TransformacionesComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  private readonly motor = inject(PeajesMotorTransformacionService);
  readonly state = inject(PeajesWizardStateService);

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService
  ) {}

  descriptors: AlgorithmDescriptor[] = [];
  drafts: ConfiguracionPlantillaDraft[] = [];
  selectedClientId: string | null = null;

  algorithmSearch = '';
  errores: ErrorValidacionPasada[] = [];
  filasPreviewIo: Record<string, unknown>[] = [];
  columnasTabla: string[] = [];
  previewLoading = false;

  mensaje = '';
  successMsg = '';
  errorMsg = '';
  guardando = false;

  /** Panel de carga / guardar */
  showLoadPanel = false;
  showSavePanel = false;
  saveAsNew = false;
  plantillas: PlantillaConfiguracion[] = [];
  plantillaLoadId = '';
  saveNombre = '';
  saveDescripcion = '';

  pendingDeleteId: string | null = null;

  /** Campos del panel de configuración del paso seleccionado */
  editAlgoritmo = '';
  editEntradas: string[] = [];
  editSalida = '';
  /** Si true, editSalida es nombre libre (no solo catálogo estándar). */
  editSalidaCustom = false;
  editParams: Record<string, unknown> = {};
  editHabilitado = true;
  editObligatoria = true;

  readonly destinosEstandar = PASADA_COLUMN_KEYS;
  /** Copia mutable: `*ngFor` no acepta el tuple `readonly` de FORMATOS_FECHA_HORA. */
  readonly formatosFechaHora: string[] = [...FORMATOS_FECHA_HORA];

  ngOnInit(): void {
    this.descriptors = this.motor.getAlgorithmDescriptors();
    this.state.seedDemoPipelineIfEmpty();
    this.syncFromState();
    this.recompute();
    const meta = this.state.snapshot().plantillaMeta;
    if (meta) {
      this.saveNombre = meta.nombre;
      this.saveDescripcion = meta.descripcion ?? '';
    }
  }

  get dirty(): boolean {
    return this.state.isPipelineDirty();
  }

  get columnasIncluidas(): string[] {
    return this.state.columnasParaMapeo();
  }

  get selectedStep(): ConfiguracionPlantillaDraft | null {
    if (!this.selectedClientId) return null;
    return this.drafts.find((d) => d.clientId === this.selectedClientId) ?? null;
  }

  get descriptorsFiltrados(): AlgorithmDescriptor[] {
    const q = this.algorithmSearch.trim().toLowerCase();
    if (!q) return this.descriptors;
    return this.descriptors.filter(
      (d) =>
        d.codigo.toLowerCase().includes(q) ||
        d.nombre.toLowerCase().includes(q) ||
        d.descripcion.toLowerCase().includes(q) ||
        d.categoria.toLowerCase().includes(q)
    );
  }

  get selectedDescriptor(): AlgorithmDescriptor | undefined {
    return this.descriptors.find((d) => d.codigo === this.editAlgoritmo);
  }

  /** Columnas disponibles para inputs (origen + salidas de otros pasos). */
  get columnasParaInputs(): string[] {
    const set = new Set(this.columnasIncluidas);
    for (const d of this.drafts) {
      const out = (d.columna_destino || d.nombre_columna || '').trim();
      if (out) set.add(out);
    }
    return [...set];
  }

  get inputsSeleccionados(): string[] {
    const step = this.selectedStep;
    if (!step) return [];
    return step.configuracion?.columnas_entrada ?? [];
  }

  get outputSeleccionado(): string {
    const step = this.selectedStep;
    if (!step) return '';
    return (step.columna_destino || step.nombre_columna || '').trim();
  }

  descriptorDe(step: ConfiguracionPlantillaDraft): AlgorithmDescriptor | undefined {
    const codigo = step.configuracion?.algoritmo_codigo;
    return codigo ? this.descriptors.find((d) => d.codigo === codigo) : undefined;
  }

  nombreAlgoritmo(step: ConfiguracionPlantillaDraft): string {
    const d = this.descriptorDe(step);
    return d?.nombre ?? step.configuracion?.algoritmo_codigo ?? 'Sin algoritmo';
  }

  resumenPaso(step: ConfiguracionPlantillaDraft): string {
    const d = this.descriptorDe(step);
    const cfg = {
      ...(step.configuracion ?? {}),
      ...(step.configuracion?.parametros ?? {}),
      columnas_entrada: step.configuracion?.columnas_entrada,
    };
    return d?.resumen(cfg) ?? '—';
  }

  fuentesPaso(step: ConfiguracionPlantillaDraft): string {
    const cols = step.configuracion?.columnas_entrada ?? [];
    if (cols.length) return cols.join(', ');
    const p = step.configuracion?.parametros?.['columna'];
    if (typeof p === 'string' && p) return p;
    return step.nombre_columna || '—';
  }

  salidaPaso(step: ConfiguracionPlantillaDraft): string {
    return (step.columna_destino || step.nombre_columna || '—').trim() || '—';
  }

  estaHabilitado(step: ConfiguracionPlantillaDraft): boolean {
    return step.configuracion?.habilitado !== false;
  }

  erroresPaso(step: ConfiguracionPlantillaDraft): ErrorValidacionPasada[] {
    const codigo = step.configuracion?.algoritmo_codigo ?? '';
    const entradas = new Set(
      (step.configuracion?.columnas_entrada ?? []).map((c) => c.toUpperCase())
    );
    const out = (step.columna_destino || step.nombre_columna || '').toUpperCase();

    return this.errores.filter((e) => {
      if (e.valor === step.orden) return true;
      if (
        e.motivo.includes(`orden ${step.orden}`) ||
        e.motivo.includes(`orden=${step.orden}`)
      ) {
        return true;
      }
      if (codigo && e.motivo.startsWith(codigo)) return true;
      const col = (e.columna ?? '').toUpperCase();
      if (entradas.has(col)) return true;
      if (col && col === out) return true;
      if (col === (step.nombre_columna || '').toUpperCase()) return true;
      return false;
    });
  }

  badgeValidacion(step: ConfiguracionPlantillaDraft): 'ok' | 'error' | 'off' {
    if (!this.estaHabilitado(step)) return 'off';
    return this.erroresPaso(step).length ? 'error' : 'ok';
  }

  isColumnaUsada(columna: string): boolean {
    const upper = columna.toUpperCase();
    return this.drafts.some((d) => {
      const entradas = (d.configuracion?.columnas_entrada ?? []).map((c) => c.toUpperCase());
      if (entradas.includes(upper)) return true;
      if ((d.nombre_columna || '').toUpperCase() === upper) return true;
      return false;
    });
  }

  isColumnaHighlighted(columna: string): boolean {
    const step = this.selectedStep;
    if (!step) return false;
    const upper = columna.toUpperCase();
    const entradas = (step.configuracion?.columnas_entrada ?? []).map((c) => c.toUpperCase());
    if (entradas.includes(upper)) return true;
    const out = (step.columna_destino || step.nombre_columna || '').toUpperCase();
    return out === upper;
  }

  isColumnaOutput(columna: string): boolean {
    const step = this.selectedStep;
    if (!step) return false;
    const out = (step.columna_destino || step.nombre_columna || '').toUpperCase();
    return out === columna.toUpperCase();
  }

  isColumnaInput(columna: string): boolean {
    const step = this.selectedStep;
    if (!step) return false;
    return (step.configuracion?.columnas_entrada ?? [])
      .map((c) => c.toUpperCase())
      .includes(columna.toUpperCase());
  }

  syncFromState(): void {
    this.drafts = this.state.getConfiguracionesDraft();
    if (this.selectedClientId && !this.drafts.some((d) => d.clientId === this.selectedClientId)) {
      this.selectedClientId = null;
    }
    if (!this.selectedClientId && this.drafts.length) {
      this.selectedClientId = this.drafts[0].clientId;
    }
    this.loadEditFromSelected();
  }

  recompute(): void {
    this.previewLoading = true;
    this.errorMsg = '';
    try {
      const configs = this.state.toConfiguracionesPlantilla();
      const columnas = this.columnasIncluidas;
      this.errores = this.motor.validarDependenciasPipeline(configs, columnas);

      const preview = this.state.snapshot().preview;
      const filasBase = (preview?.filasPreview ?? []).slice(0, 10).map((f) => {
        const row: Record<string, unknown> = {};
        for (const c of columnas) {
          row[c] = f[c];
        }
        return row;
      });

      let transformadas: Record<string, unknown>[] = [];
      const selected = this.selectedStep;
      if (configs.length === 0 || filasBase.length === 0) {
        transformadas = filasBase;
      } else if (selected) {
        transformadas = this.motor.previsualizarPaso(configs, filasBase, selected.orden);
      } else {
        transformadas = this.motor.aplicarPipeline(filasBase, configs);
      }

      this.filasPreviewIo = filasBase.map((orig, i) => ({
        ...orig,
        ...(transformadas[i] ?? {}),
      }));

      const colSet = new Set<string>(columnas);
      for (const row of this.filasPreviewIo) {
        Object.keys(row).forEach((k) => colSet.add(k));
      }
      for (const d of this.drafts) {
        const out = (d.columna_destino || d.nombre_columna || '').trim();
        if (out) colSet.add(out);
      }
      this.columnasTabla = [...colSet];

      this.mensaje =
        this.drafts.length === 0
          ? 'Pipeline vacío. Añadí un paso o cargá una plantilla.'
          : `${this.drafts.length} paso(s) · ${this.errores.length} error(es) de dependencia`;
    } catch (e) {
      this.errorMsg = e instanceof Error ? e.message : 'Error al previsualizar el pipeline';
      this.filasPreviewIo = [];
    } finally {
      this.previewLoading = false;
    }
  }

  afterMutation(): void {
    this.syncFromState();
    this.recompute();
    this.successMsg = '';
  }

  seleccionarPaso(clientId: string): void {
    this.selectedClientId = clientId;
    this.loadEditFromSelected();
    this.recompute();
  }

  seleccionarColumnaRail(columna: string): void {
    const hit = this.drafts.find((d) => {
      const entradas = d.configuracion?.columnas_entrada ?? [];
      return entradas.includes(columna) || d.nombre_columna === columna;
    });
    if (hit) {
      this.seleccionarPaso(hit.clientId);
    }
  }

  loadEditFromSelected(): void {
    const step = this.selectedStep;
    if (!step) {
      this.editAlgoritmo = '';
      this.editEntradas = [];
      this.editSalida = '';
      this.editSalidaCustom = false;
      this.editParams = {};
      this.editHabilitado = true;
      this.editObligatoria = true;
      return;
    }
    this.editAlgoritmo = step.configuracion?.algoritmo_codigo ?? '';
    this.editEntradas = [...(step.configuracion?.columnas_entrada ?? [])];
    this.editSalida = (step.columna_destino || step.nombre_columna || '').trim();
    this.editSalidaCustom = !!(
      this.editSalida &&
      !this.destinosEstandar.includes(this.editSalida as (typeof PASADA_COLUMN_KEYS)[number])
    );
    this.editParams = { ...(step.configuracion?.parametros ?? {}) };
    if (
      this.editAlgoritmo === 'FORMATEAR_FECHA_HORA' &&
      !this.editParams['formato_hora']
    ) {
      this.editParams = { ...this.editParams, formato_hora: 'HHMMSS' };
    }
    this.editHabilitado = step.configuracion?.habilitado !== false;
    this.editObligatoria = step.obligatoria;
  }

  aplicarEdicion(): void {
    if (!this.selectedClientId) return;
    const entradas = this.editEntradas.filter((c) => !!c && c.trim());
    const params = { ...this.editParams };
    if (entradas.length === 1 && !params['columna']) {
      params['columna'] = entradas[0];
    }
    if (entradas.length > 0) {
      params['columnas'] = [...entradas];
    }
    if (this.editAlgoritmo === 'FORMATEAR_FECHA_HORA' && !params['formato_hora']) {
      params['formato_hora'] = 'HHMMSS';
    }

    const desc = this.selectedDescriptor;
    this.state.updateDraftStep(this.selectedClientId, {
      nombre_columna:
        entradas[0] ||
        this.editSalida ||
        this.selectedStep?.nombre_columna ||
        'COL',
      columna_destino: this.editSalida.trim() || null,
      obligatoria: this.editObligatoria,
      configuracion: {
        algoritmo_codigo: this.editAlgoritmo || undefined,
        columnas_entrada: [...entradas],
        parametros: params,
        habilitado: this.editHabilitado,
      },
    });

    if (desc) {
      const localErrs = desc.validar({
        ...params,
        algoritmo_codigo: this.editAlgoritmo,
        columnas_entrada: entradas,
      });
      if (localErrs.length) {
        this.errorMsg = localErrs.map((e) => e.motivo).join('; ');
      } else {
        this.errorMsg = '';
      }
    }

    this.afterMutation();
  }

  onAlgoritmoChange(): void {
    this.editParams = {};
    const desc = this.selectedDescriptor;
    if (desc) {
      for (const field of desc.parametrosSchema) {
        if (field.nombre === 'columnas_entrada' || field.nombre === 'columnas') continue;
        if (field.nombre === 'columna') continue;
        if (field.nombre === 'formato_hora') {
          this.editParams['formato_hora'] = field.opciones?.[0] ?? 'HHMMSS';
          continue;
        }
        if (field.nombre === 'valor' && this.editParams['valor'] === undefined) {
          this.editParams['valor'] = 1;
        }
        if (field.nombre === 'operacion' && this.editParams['operacion'] === undefined) {
          this.editParams['operacion'] = field.opciones?.[0] ?? 'sumar';
        }
      }
      if (desc.codigo === 'ASIGNAR_VALOR') {
        this.editSalida = this.editSalida || 'QUANTITY';
        this.editSalidaCustom = false;
      }
      if (desc.codigo === 'FORMATEAR_FECHA_HORA') {
        this.editSalida = 'FECHA_HORA';
        this.editSalidaCustom = false;
        const fecha = this.columnasParaInputs.find((c) => c.toUpperCase() === 'FECHA');
        const hora = this.columnasParaInputs.find((c) => c.toUpperCase() === 'HORA');
        this.editEntradas = [fecha, hora].filter((c): c is string => !!c);
        if (!this.editParams['formato_hora']) {
          this.editParams['formato_hora'] = 'HHMMSS';
        }
      }
      if (desc.codigo === 'CALCULAR_IMPORTE_NETO' || desc.codigo === 'ELIMINAR_IVA') {
        this.editSalida = this.editSalida || 'IMPORTE_NETO';
        this.editSalidaCustom = false;
        if (desc.codigo === 'ELIMINAR_IVA') {
          this.editEntradas = ['IMPORTE_NETO'];
        }
      }
    }
    this.aplicarEdicion();
  }

  /** FORMATEAR_FECHA_HORA usa selects ordenados (fecha, hora). */
  get esFormatearFechaHora(): boolean {
    return this.editAlgoritmo === 'FORMATEAR_FECHA_HORA';
  }

  setEntradaOrdenada(index: number, columna: string): void {
    const fecha = index === 0 ? columna : this.editEntradas[0] || '';
    const hora = index === 1 ? columna : this.editEntradas[1] || '';
    this.editEntradas = [fecha, hora];
    this.aplicarEdicion();
  }

  toggleEntrada(columna: string, checked: boolean): void {
    if (checked) {
      if (!this.editEntradas.includes(columna)) {
        this.editEntradas = [...this.editEntradas, columna];
      }
    } else {
      this.editEntradas = this.editEntradas.filter((c) => c !== columna);
    }
    this.aplicarEdicion();
  }

  paramFields(): ParametroSchemaField[] {
    const desc = this.selectedDescriptor;
    if (!desc) return [];
    return desc.parametrosSchema.filter(
      (f) =>
        f.nombre !== 'columnas_entrada' &&
        f.nombre !== 'columnas' &&
        f.nombre !== 'columna'
    );
  }

  setParam(nombre: string, value: unknown): void {
    this.editParams = { ...this.editParams, [nombre]: value };
    this.aplicarEdicion();
  }

  paramAsString(nombre: string): string {
    const v = this.editParams[nombre];
    return v === undefined || v === null ? '' : String(v);
  }

  /** Opciones del select enum / formato_hora (siempre `string[]` mutable para `*ngFor`). */
  opcionesEnum(field: ParametroSchemaField): string[] {
    return field.opciones?.length ? field.opciones : this.formatosFechaHora;
  }

  setSalidaEstandar(destino: string): void {
    if (destino === '__custom__') {
      this.editSalidaCustom = true;
      if (this.destinosEstandar.includes(this.editSalida as (typeof PASADA_COLUMN_KEYS)[number])) {
        this.editSalida = '';
      }
      return;
    }
    this.editSalidaCustom = false;
    this.editSalida = destino;
    this.aplicarEdicion();
  }

  get salidaSelectValue(): string {
    if (this.editSalidaCustom) return '__custom__';
    if (
      this.editSalida &&
      this.destinosEstandar.includes(this.editSalida as (typeof PASADA_COLUMN_KEYS)[number])
    ) {
      return this.editSalida;
    }
    if (this.editSalida) return '__custom__';
    return '';
  }

  anadirPaso(): void {
    const created = this.state.addDraftStep({
      tipo: 'transformacion',
      nombre_columna: this.columnasIncluidas[0] ?? 'COL',
      columna_destino: '',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'COPIAR_COLUMNA',
        columnas_entrada: this.columnasIncluidas[0] ? [this.columnasIncluidas[0]] : [],
        parametros: this.columnasIncluidas[0]
          ? { columna: this.columnasIncluidas[0] }
          : {},
        habilitado: true,
      },
      obligatoria: false,
    });
    this.selectedClientId = created.clientId;
    this.afterMutation();
  }

  duplicarPaso(clientId: string, event?: Event): void {
    event?.stopPropagation();
    const copy = this.state.duplicateDraftStep(clientId);
    if (copy) {
      this.selectedClientId = copy.clientId;
      this.afterMutation();
    }
  }

  toggleHabilitado(clientId: string, event?: Event): void {
    event?.stopPropagation();
    const step = this.drafts.find((d) => d.clientId === clientId);
    if (!step) return;
    const next = !this.estaHabilitado(step);
    this.state.setStepHabilitado(clientId, next);
    this.afterMutation();
  }

  pedirBorrar(clientId: string, event?: Event): void {
    event?.stopPropagation();
    this.pendingDeleteId = clientId;
  }

  cancelarBorrar(): void {
    this.pendingDeleteId = null;
  }

  confirmarBorrar(): void {
    if (!this.pendingDeleteId) return;
    const id = this.pendingDeleteId;
    this.pendingDeleteId = null;
    if (this.selectedClientId === id) {
      this.selectedClientId = null;
    }
    this.state.removeDraftStep(id);
    this.afterMutation();
  }

  onDrop(event: CdkDragDrop<ConfiguracionPlantillaDraft[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.state.reorderDraftSteps(event.previousIndex, event.currentIndex);
    this.afterMutation();
  }

  validarAhora(): void {
    this.recompute();
    this.successMsg =
      this.errores.length === 0
        ? 'Pipeline válido: sin errores de dependencia.'
        : `Se encontraron ${this.errores.length} error(es). Revisá las tarjetas marcadas.`;
  }

  refrescarPreview(): void {
    this.recompute();
    this.successMsg = 'Vista previa actualizada.';
  }

  descartarCambios(): void {
    if (this.dirty && !window.confirm('¿Descartar los cambios no guardados del pipeline?')) {
      return;
    }
    this.state.discardPipelineChanges();
    this.selectedClientId = null;
    this.afterMutation();
    this.successMsg = 'Cambios descartados.';
  }

  abrirGuardar(asNew = false): void {
    this.saveAsNew = asNew;
    const meta = this.state.snapshot().plantillaMeta;
    const snap = this.state.snapshot();
    this.saveNombre =
      asNew && meta?.nombre
        ? `${meta.nombre} (copia)`
        : meta?.nombre || this.saveNombre || 'Plantilla wizard';
    this.saveDescripcion = meta?.descripcion ?? this.saveDescripcion;
    if (!snap.empresaId && !meta?.empresa_id) {
      this.errorMsg = 'Seleccioná una empresa en el paso 1 antes de guardar la plantilla.';
      return;
    }
    this.showSavePanel = true;
    this.showLoadPanel = false;
  }

  cerrarPaneles(): void {
    this.showSavePanel = false;
    this.showLoadPanel = false;
  }

  async guardarPlantilla(): Promise<void> {
    const nombre = this.saveNombre.trim();
    if (!nombre) {
      this.errorMsg = 'Ingresá un nombre para la plantilla.';
      return;
    }
    const snap = this.state.snapshot();
    const empresaId = snap.plantillaMeta?.empresa_id || snap.empresaId;
    if (!empresaId) {
      this.errorMsg = 'Falta empresa_id para guardar la plantilla.';
      return;
    }

    const configsFull = this.state.toConfiguracionesPlantilla();
    const configsOmit = configsFull.map(
      ({ id: _id, plantilla_id: _p, ...rest }) => rest
    );

    const existingId =
      !this.saveAsNew && (snap.plantillaMeta?.id || snap.plantillaId)
        ? (snap.plantillaMeta?.id || snap.plantillaId)!
        : undefined;

    const meta = {
      id: existingId,
      nombre,
      descripcion: this.saveDescripcion.trim() || null,
      empresa_id: empresaId,
      estado: (snap.plantillaMeta?.estado as PlantillaConfiguracion['estado']) || 'borrador',
    };

    this.guardando = true;
    this.errorMsg = '';
    try {
      const saved = await firstValueFrom(
        this.plantillasSvc.guardarPlantilla(meta, configsOmit, snap.mapeos, snap.relacionesEstacion
          .filter((r) => !!r.estacionId)
          .map((r) => ({ estacion_id: r.estacionId!, valor_proveedor: r.valorProveedor, valor_normalizado: r.valorProveedor.trim().toUpperCase(), origen: 'plantilla' as const })))
      );
      await firstValueFrom(
        this.plantillasSvc.sobrescribirConfiguraciones(saved.id, configsOmit)
      );
      const wizardMeta: PlantillaWizardMeta = {
        id: saved.id,
        nombre: saved.nombre,
        descripcion: saved.descripcion ?? null,
        empresa_id: saved.empresa_id,
        estado: saved.estado,
        tipo_archivo: snap.plantillaMeta?.tipo_archivo ?? null,
      };
      this.state.setPlantillaMeta(wizardMeta);
      this.state.markPipelineSaved();
      this.successMsg = this.saveAsNew
        ? `Plantilla «${saved.nombre}» creada.`
        : `Plantilla «${saved.nombre}» guardada.`;
      this.showSavePanel = false;
      this.syncFromState();
    } catch (e) {
      this.errorMsg = e instanceof Error ? e.message : 'Error al guardar la plantilla';
    } finally {
      this.guardando = false;
    }
  }

  async abrirCargar(): Promise<void> {
    this.showLoadPanel = true;
    this.showSavePanel = false;
    const empresaId = this.state.snapshot().empresaId ?? undefined;
    try {
      this.plantillas = await firstValueFrom(
        this.plantillasSvc.listarPlantillas(empresaId)
      );
      this.plantillaLoadId = this.state.snapshot().plantillaId ?? '';
    } catch (e) {
      this.errorMsg = e instanceof Error ? e.message : 'No se pudieron listar plantillas';
    }
  }

  async cargarPlantillaSeleccionada(): Promise<void> {
    if (!this.plantillaLoadId) {
      this.errorMsg = 'Elegí una plantilla para cargar.';
      return;
    }
    if (this.dirty && !window.confirm('Hay cambios sin guardar. ¿Reemplazar el pipeline actual?')) {
      return;
    }
    try {
      const plantilla = await firstValueFrom(
        this.plantillasSvc.obtenerPlantilla(this.plantillaLoadId)
      );
      if (!plantilla) {
        this.errorMsg = 'Plantilla no encontrada.';
        return;
      }
      const drafts = this.configsToDrafts(plantilla.configuraciones ?? []);
      this.state.setConfiguracionesDraft(drafts);
      this.state.setPlantillaMeta({
        id: plantilla.id,
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion ?? null,
        empresa_id: plantilla.empresa_id,
        estado: plantilla.estado,
      });
      this.state.markPipelineSaved();
      this.saveNombre = plantilla.nombre;
      this.saveDescripcion = plantilla.descripcion ?? '';
      this.selectedClientId = null;
      this.showLoadPanel = false;
      this.afterMutation();
      this.successMsg = `Plantilla «${plantilla.nombre}» cargada.`;
    } catch (e) {
      this.errorMsg = e instanceof Error ? e.message : 'Error al cargar la plantilla';
    }
  }

  async duplicarPlantilla(): Promise<void> {
    this.abrirGuardar(true);
  }

  private configsToDrafts(
    configs: ConfiguracionPlantilla[]
  ): ConfiguracionPlantillaDraft[] {
    return [...configs]
      .sort((a, b) => a.orden - b.orden)
      .map((c) => {
        const cfg = c.configuracion ? { ...c.configuracion } : null;
        const algoritmo_codigo =
          (cfg?.['algoritmo_codigo'] as string | undefined) ?? undefined;
        let columnas_entrada = Array.isArray(cfg?.['columnas_entrada'])
          ? (cfg!['columnas_entrada'] as string[])
          : Array.isArray(cfg?.['columnas'])
            ? (cfg!['columnas'] as string[])
            : undefined;
        const parametros: Record<string, unknown> = {};
        if (cfg) {
          for (const [k, v] of Object.entries(cfg)) {
            if (
              k === 'algoritmo_codigo' ||
              k === 'columnas_entrada' ||
              k === 'habilitado'
            ) {
              continue;
            }
            parametros[k] = v;
          }
        }
        const habilitado = cfg?.['habilitado'] !== false;
        return {
          clientId: cryptoRandomId(),
          orden: c.orden,
          tipo: c.tipo,
          nombre_columna: c.nombre_columna,
          columna_destino: c.columna_destino ?? null,
          algoritmo_combinado_id: c.algoritmo_combinado_id ?? null,
          configuracion: {
            ...(algoritmo_codigo ? { algoritmo_codigo } : {}),
            ...(columnas_entrada ? { columnas_entrada } : {}),
            parametros,
            habilitado,
          },
          obligatoria: c.obligatoria,
        };
      });
  }

  celda(fila: Record<string, unknown>, col: string): string {
    const v = fila[col];
    if (v === null || v === undefined) return '—';
    return String(v);
  }

  continuar(): void {
    if (this.errores.length) {
      const ok = window.confirm(
        `Hay ${this.errores.length} error(es) de validación en el pipeline. ¿Continuar de todos modos?`
      );
      if (!ok) return;
    }
    // Propaga salidas del pipeline al mapeo (FECHA_HORA, etc.) y marca orígenes resueltos
    this.state.sincronizarMapeosDesdePipeline();
    this.completado.emit();
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
