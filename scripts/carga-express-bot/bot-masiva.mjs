import fs from 'node:fs';
import { closeHandle, openNewTab, switchToHandle } from './utils/driver.mjs';
import { notifyUser } from './utils/notify.mjs';
import { compactStatusMessage, resolveRepoPath, STATUS } from './utils/status-csv.mjs';
import {
  describeMasivaAllowlistIdle,
  isPendingMasivaRecord,
  masivaRowKey,
  updateRecordStatus,
} from './utils/status-masiva.mjs';
import { invoiceAiMasivaCanProceed, invoiceAiMasivaOutcome, invoiceAiMasivaParkMessage, queueIsIdle, shouldDeferNewMasivaTab } from './utils/invoice-ai-masiva-wait.mjs';
import { BasePage } from './pages/base.page.mjs';
import { LoginPage } from './pages/login.page.mjs';
import { Paso1CargaPage } from './pages/paso1-carga.page.mjs';
import { PasoPatentesPage } from './pages/paso-patentes.page.mjs';
import { Paso6EstacionesPage } from './pages/paso6-estaciones.page.mjs';
import { Paso7FacturaPage } from './pages/paso7-factura.page.mjs';
import { Paso8ValidacionPage } from './pages/paso8-validacion.page.mjs';
import { Paso9RevisionPage } from './pages/paso9-revision.page.mjs';
import { masivaValidationUserInputMessage } from './utils/validation-failure.mjs';
import { createSessionReport } from './utils/session-report.mjs';

const DEFAULT_AI_TIMEOUT_MS = 480000;

export class CargaExpressMasivaBot {
  constructor({
    driver,
    store,
    baseUrl,
    email,
    password,
    limit,
    folderFilter,
    allowedFolders = [],
    plantilla,
    aiTimeoutMs,
  }) {
    this.driver = driver;
    this.store = store;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.expressUrl = `${this.baseUrl}/peajes/carga-express`;
    this.email = email;
    this.password = password;
    this.limit = limit ?? Infinity;
    this.folderFilter = folderFilter ?? null;
    this.allowedFolders = [...allowedFolders];
    this.plantilla = plantilla || 'MASIVOOO';
    this.aiTimeoutMs = Number.isFinite(aiTimeoutMs) ? aiTimeoutMs : DEFAULT_AI_TIMEOUT_MS;
    this.parked = [];
    this.skippedKeys = new Set();
    this.processed = 0;
    this.sessionStartedAt = new Date().toISOString();
    this.sessionEntries = [];
    this.statusEvents = 0;
    this.pages = {
      base: new BasePage(driver),
      login: new LoginPage(driver),
      paso1: new Paso1CargaPage(driver),
      patentes: new PasoPatentesPage(driver),
      estaciones: new Paso6EstacionesPage(driver),
      factura: new Paso7FacturaPage(driver),
      validacion: new Paso8ValidacionPage(driver),
      revision: new Paso9RevisionPage(driver),
    };
  }

  pendingRecords() {
    return this.store.records.filter((record) =>
      isPendingMasivaRecord(record, {
        allowedFolders: this.allowedFolders,
        parkedKeys: this.parked.map((item) => item.key),
        skippedKeys: [...this.skippedKeys],
        folderFilter: this.folderFilter,
      }),
    );
  }

  async ensureLoggedIn() {
    await this.driver.get(this.expressUrl);
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log('Esperando que Angular resuelva /login o carga-express…');
      const step = await this.pages.base.waitUntilKnownStep(45000);
      if (step !== 'login') break;
      console.log(`Estamos en /login?returnUrl=/peajes/carga-express (intento ${attempt}). Voy a autenticar y abrir carga-express.`);
      await this.pages.login.login(this.email, this.password);
      await this.driver.get(this.expressUrl);
    }
    const after = await this.pages.base.waitUntilKnownStep(45000);
    if (after === 'login') {
      throw new Error(
        'Sigue en /login?returnUrl=/peajes/carga-express después de autenticar. Revisá IBARRA_EMAIL / IBARRA_PASSWORD.',
      );
    }
    if (after === 'denied') throw new Error('Acceso denegado: la cuenta necesita peajes:manage.');
    if (after !== 'carga') {
      await this.driver.get(this.expressUrl);
      const settled = await this.pages.base.waitUntilKnownStep(45000);
      if (settled !== 'carga') {
        throw new Error(`No llegué a Paso 1 de carga-express (paso=${settled}).`);
      }
    }
  }

  async run() {
    await this.ensureLoggedIn();

    while (this.processed < this.limit) {
      await this.pollParked();
      if (shouldDeferNewMasivaTab(this.parked)) {
        const waiting = this.parked.filter((item) => item.stage === 'factura' && item.waitForAi !== false);
        console.log(`Esperando IA/chips en ${waiting.map((item) => item.key).join(', ')} (no abro la siguiente carpeta)…`);
        await this.driver.sleep(5000);
        continue;
      }
      const pending = this.pendingRecords();
      if (!pending.length) {
        if (!this.parked.length) {
          console.log(describeMasivaAllowlistIdle(this.store.records, this.allowedFolders));
          break;
        }
        console.log(`Esperando ${this.parked.length} carpeta(s) en USER_INPUT…`);
        await this.driver.sleep(8000);
        continue;
      }
      const record = pending[0];
      const handle = await this.openRowTab();
      try {
        const outcome = await this.processRecord(record, { handle });
        if (outcome === 'parked') continue;
        if (outcome === 'complete' || outcome === 'failed' || outcome === 'duplicated' || outcome === 'skipped') {
          this.processed += 1;
        }
        await closeHandle(this.driver, handle);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.park(record, handle, 'error', message);
      }
    }

    if (this.parked.length) {
      console.log(`${this.parked.length} carpeta(s) quedan en USER_INPUT. El navegador sigue abierto para que las completes.`);
      while (this.parked.length) {
        await this.pollParked();
        if (!this.parked.length) break;
        await this.driver.sleep(8000);
      }
    }
  }

  async openRowTab() {
    if (this.parked.length === 0) {
      const handles = await this.driver.getAllWindowHandles();
      if (handles.length === 1) {
        await switchToHandle(this.driver, handles[0]);
        await this.driver.get(this.expressUrl);
        return handles[0];
      }
    }
    return openNewTab(this.driver, this.expressUrl);
  }

  async processRecord(record, { handle }) {
    await switchToHandle(this.driver, handle);
    const folder = masivaRowKey(record);
    console.log(`[RUNNING] ${folder}`);
    updateRecordStatus(this.store, record, 'IN_PROGRESS', 'Procesando carga-express masiva…');

    if (record._skipReason) {
      return this.skipRecord(record, record._skipReason);
    }

    const xlsx = record._xlsxAbs || resolveRepoPath(record.xlsx);
    const pdfs = record._pdfs ?? [];
    if (!xlsx || !fs.existsSync(xlsx)) {
      return this.skipRecord(record, 'Falta MAPPED xlsx');
    }
    if (!pdfs.length) {
      return this.skipRecord(record, 'Falta Comprobantes/*.pdf');
    }

    let step = await this.pages.base.detectStep();
    if (step === 'unknown') step = await this.pages.base.waitUntilKnownStep(45000);
    if (step === 'login') {
      await this.ensureLoggedIn();
      step = await this.pages.base.waitUntilKnownStep(45000);
    }
    if (step !== 'carga') {
      await this.driver.get(this.expressUrl);
      step = await this.pages.base.waitUntilKnownStep(45000);
    }
    if (step !== 'carga') {
      throw new Error(`No puedo cargar archivos: el wizard está en «${step}», no en Paso 1.`);
    }

    await this.pages.paso1.selectMasiva();
    await this.pages.paso1.uploadMasiva(xlsx, pdfs);
    try {
      await this.pages.paso1.selectPlantilla(this.plantilla);
    } catch (error) {
      const message =
        `Paso 1: no pude seleccionar Plantilla «${this.plantilla}». ` +
        `${error instanceof Error ? error.message : error} Escribí el valor en el buscador y elegí la opción correcta, luego pulsá Aplicar plantilla.`;
      return this.park(record, handle, 'carga', message);
    }
    step = await this.pages.paso1.continueToNext(180000);
    return this.continueFromStep(record, { handle, step });
  }

  async continueFromStep(record, { handle, step }) {
    await switchToHandle(this.driver, handle);
    let current = step || (await this.pages.base.detectStep());

    if (current === 'patentes') {
      const message = await this.pages.patentes.helpMessage();
      return this.park(record, handle, 'patentes', message);
    }

    if (current === 'estaciones') {
      const result = await this.pages.estaciones.resolveOrReport();
      if (result.skipped) {
        current = await this.pages.base.detectStep();
      } else if (!result.ok) {
        const codes = result.unresolved.map((item) => `${item.codigo} (${item.reason})`).join('; ');
        const message =
          `Paso Estaciones: relacioná CODIGO PROVEEDOR → Estación. Pendientes: ${codes}. ` +
          'No elijo estaciones inciertas. Cuando termines, pulsá Continuar.';
        return this.park(record, handle, 'estaciones', message);
      } else {
        current = await this.pages.base.waitForStepChange('estaciones', 90000);
      }
    }

    if (current === 'factura') {
      const facturaResult = await this.fillFacturaMasiva(record, { handle });
      if (facturaResult === 'parked') return 'parked';
      current = await this.pages.base.detectStep();
    }

    if (current === 'validacion') {
      const state = await this.pages.validacion.continue();
      if (state.skipped) {
        current = await this.pages.base.detectStep();
      } else if (!state.enabled) {
        return this.park(record, handle, 'validacion', masivaValidationUserInputMessage(state));
      } else {
        current = await this.pages.base.waitForStepChange('validacion', 30000);
      }
    }

    if (current === 'revision') {
      try {
        await this.pages.revision.confirm({ timeoutMs: 120000 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return this.park(
          record,
          handle,
          'revision',
          `Paso Revisión: ${message} Dejá el diálogo «Carga confirmada» a la vista o revisá el error, luego pulsá Cargar otro archivo.`,
        );
      }
      updateRecordStatus(this.store, record, STATUS.COMPLETE, '');
      this.reportStatus(record, STATUS.COMPLETE);
      this.addSessionEntry(record, 'complete', '');
      return 'complete';
    }

    return this.park(
      record,
      handle,
      current,
      `El wizard quedó en el paso «${current}» y no puedo continuar solo. Necesito que revises la pantalla.`,
    );
  }

  async fillFacturaMasiva(record, { handle }) {
    const expectedPdfs = record._pdfs?.length ?? Number(record.pdfCount) ?? 0;
    const snapshot = await this.pages.factura.waitMasivaAiSettled(this.aiTimeoutMs, { expectedPdfs });
    const extras = {
      expectedPdfs,
      elapsedMs: snapshot.elapsedMs ?? this.aiTimeoutMs,
      idleMs: snapshot.idleMs ?? (queueIsIdle(snapshot) ? 60_000 : 0),
      sawLoader: Boolean(snapshot.sawLoader),
      minWaitMs: 0,
    };
    const outcome = invoiceAiMasivaOutcome(snapshot, extras);
    console.log(
      `[AI] ${masivaRowKey(record)} outcome=${outcome} ready=${snapshot.readyBadges} error=${snapshot.errorBadges} loading=${snapshot.loadingBadges} pdf=${snapshot.idlePdfBadges} timedOut=${Boolean(snapshot.timedOut)}`,
    );
    const parkMessage = invoiceAiMasivaParkMessage(snapshot, {
      timedOut: Boolean(snapshot.timedOut),
      expectedPdfs,
    });
    if (parkMessage) {
      return this.park(record, handle, 'factura', parkMessage, { waitForAi: true });
    }

    const clicked = await this.pages.factura.applyMasivaSuggestionChips();
    console.log(`[AI] ${masivaRowKey(record)} chipsClicked=${clicked}`);

    let result;
    try {
      result = await this.pages.factura.continueIfValidMasiva();
    } catch (error) {
      const parked = this.park(
        record,
        handle,
        'factura',
        `Paso Factura inválido: ${error instanceof Error ? error.message : error}. Completá a mano y pulsá Continuar.`,
        { waitForAi: true, chipsApplied: false },
      );
      return parked;
    }
    if (!result.ok) {
      const detail = result.message || result.missing?.join(', ') || 'el formulario no puede continuar.';
      const parked = this.park(
        record,
        handle,
        'factura',
        `Paso Factura inválido: ${detail}. Completá a mano y pulsá Continuar.`,
        { waitForAi: true, chipsApplied: false },
      );
      return parked;
    }
    return 'ok';
  }

  skipRecord(record, message) {
    const folder = masivaRowKey(record);
    this.skippedKeys.add(folder);
    console.log(`SKIP ${folder}: ${message}`);
    this.addSessionEntry(record, 'skipped', message, { category: 'missing' });
    updateRecordStatus(this.store, record, '', message);
    return 'skipped';
  }

  reportStatus(record, status, message = '') {
    const compactMessage = compactStatusMessage(message, status);
    console.log(`[${status}] ${masivaRowKey(record)}${compactMessage ? ` — ${compactMessage}` : ''}`);
    this.statusEvents += 1;
    if (this.statusEvents % 5 === 0) {
      console.log(this.formatStatusSummary());
    }
  }

  formatStatusSummary() {
    const counts = { USER_INPUT: 0, COMPLETE: 0, FAILED: 0, DUPLICATED: 0, PENDING: 0 };
    for (const record of this.store.records) {
      const status = String(record.uploadFileStatus ?? '').trim().toUpperCase();
      if (status === STATUS.USER_INPUT) counts.USER_INPUT += 1;
      else if (status === STATUS.COMPLETE) counts.COMPLETE += 1;
      else if (status === STATUS.FAILED) counts.FAILED += 1;
      else if (status === STATUS.DUPLICATED) counts.DUPLICATED += 1;
      else counts.PENDING += 1;
    }
    return [
      '--- Estado (cada 5 carpetas)',
      `USERINPUT: ${counts.USER_INPUT} (Por ver)`,
      `COMPLETED: ${counts.COMPLETE}`,
      `FAILED: ${counts.FAILED}`,
      `DUPLICATED: ${counts.DUPLICATED}`,
      `PENDING: ${counts.PENDING}`,
      '--',
    ].join('\n');
  }

  addSessionEntry(record, outcome, message, extra = {}) {
    this.sessionEntries.push({
      numero: masivaRowKey(record),
      provider: 'TELEPEAJE-PLUS',
      outcome,
      message,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  }

  getSessionReport() {
    return createSessionReport({
      startedAt: this.sessionStartedAt,
      finishedAt: new Date().toISOString(),
      entries: this.sessionEntries,
    });
  }

  park(record, handle, stage, message, extra = {}) {
    updateRecordStatus(this.store, record, STATUS.USER_INPUT, message);
    this.reportStatus(record, STATUS.USER_INPUT, message);
    this.addSessionEntry(record, 'user_input', message, { category: stage });
    const key = masivaRowKey(record);
    const entry = {
      key,
      record,
      handle,
      stage,
      restarts: 0,
      chipsApplied: extra.chipsApplied ?? false,
      waitForAi: extra.waitForAi ?? stage === 'factura',
      parkedAt: Date.now(),
    };
    const index = this.parked.findIndex((item) => item.key === key);
    if (index >= 0) {
      entry.chipsApplied = extra.chipsApplied ?? this.parked[index].chipsApplied;
      entry.waitForAi = extra.waitForAi ?? this.parked[index].waitForAi ?? entry.waitForAi;
      this.parked[index] = entry;
    } else {
      this.parked.push(entry);
    }
    notifyUser(`Carga express masiva — ayuda ${key}`, message);
    return 'parked';
  }

  async finishParkedOutcome(item, outcome, keep) {
    if (outcome === 'parked') {
      keep.push(this.parked.find((entry) => entry.key === item.key) ?? item);
      return;
    }
    if (outcome === 'complete' || outcome === 'failed' || outcome === 'duplicated' || outcome === 'skipped') {
      this.processed += 1;
      await closeHandle(this.driver, item.handle).catch(() => {});
    }
  }

  async pollParked() {
    const items = [...this.parked];
    const keep = [];
    let handles = [];
    try {
      handles = await this.driver.getAllWindowHandles();
    } catch {
      this.parked = items;
      return;
    }
    const known = new Set(handles);

    for (const item of items) {
      try {
        if (!known.has(item.handle)) {
          console.log(`[POLL] ${item.key} tab handle gone; keeping USER_INPUT (no new tab).`);
          keep.push(item);
          continue;
        }
        await switchToHandle(this.driver, item.handle);
        const step = await this.pages.base.detectStep();
        console.log(`[POLL] ${item.key} stage=${item.stage} step=${step}`);

        const userAdvanced =
          (item.stage === 'factura' && ['validacion', 'revision'].includes(step)) ||
          (item.stage === 'validacion' && step === 'revision') ||
          ((item.stage === 'estaciones' || item.stage === 'patentes') &&
            ['factura', 'validacion', 'revision'].includes(step)) ||
          (item.stage === 'carga' && ['estaciones', 'patentes', 'factura', 'validacion', 'revision'].includes(step));

        if (userAdvanced) {
          console.log(`Reanudando ${masivaRowKey(item.record)} desde ${step} (el usuario avanzó)`);
          const outcome = await this.continueFromStep(item.record, {
            handle: item.handle,
            step,
          });
          await this.finishParkedOutcome(item, outcome, keep);
          continue;
        }

        if (item.stage === 'factura' && step === 'factura') {
          const expectedPdfs = item.record._pdfs?.length ?? Number(item.record.pdfCount) ?? 0;
          const snapshot = await this.pages.factura.masivaBadgeSnapshot();
          const elapsedMs = Date.now() - (item.parkedAt ?? Date.now());
          const aiReady = invoiceAiMasivaCanProceed(snapshot, {
            expectedPdfs,
            elapsedMs,
            idleMs: queueIsIdle(snapshot) ? 60_000 : 0,
            sawLoader: true,
            minWaitMs: 0,
          });
          if (!aiReady) {
            item.waitForAi = true;
            keep.push(item);
            continue;
          }
          console.log(
            `[AI] ${item.key} aplicando chips ready=${snapshot.readyBadges} error=${snapshot.errorBadges} chipsApplied=${Boolean(item.chipsApplied)}`,
          );
          await this.pages.factura.applyMasivaSuggestionChips();
          item.chipsApplied = true;
          const result = await this.pages.factura.continueIfValidMasiva();
          if (result.ok) {
            item.waitForAi = false;
            const outcome = await this.continueFromStep(item.record, {
              handle: item.handle,
              step: result.step || (await this.pages.base.detectStep()),
            });
            await this.finishParkedOutcome(item, outcome, keep);
            continue;
          }
          item.waitForAi = true;
          console.log(`[AI] ${item.key} Continuar still blocked: ${result.message || 'form invalid'}`);
          keep.push(item);
          continue;
        }

        if (item.stage === 'validacion' && step === 'validacion') {
          const state = await this.pages.validacion.canContinue();
          if (state.skipped || state.enabled) {
            console.log(`Reanudando ${item.key} desde validación (Continuar habilitado o ya avanzó)`);
            const outcome = await this.continueFromStep(item.record, {
              handle: item.handle,
              step: state.skipped ? (await this.pages.base.detectStep()) : 'validacion',
            });
            await this.finishParkedOutcome(item, outcome, keep);
            continue;
          }
          keep.push(item);
          continue;
        }

        keep.push(item);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`[POLL] ${item.key} error: ${message}`);
        keep.push(item);
      }
    }
    this.parked = keep;
  }
}
