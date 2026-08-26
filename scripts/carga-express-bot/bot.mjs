import fs from 'node:fs';
import { closeHandle, openNewTab, switchToHandle } from './utils/driver.mjs';
import { notifyUser } from './utils/notify.mjs';
import {
  isRetryableStatus,
  resolveRepoPath,
  rowKey,
  STATUS,
  updateRecordStatus,
} from './utils/status-csv.mjs';
import { BasePage } from './pages/base.page.mjs';
import { LoginPage } from './pages/login.page.mjs';
import { Paso1CargaPage } from './pages/paso1-carga.page.mjs';
import { PasoPatentesPage } from './pages/paso-patentes.page.mjs';
import { Paso6EstacionesPage } from './pages/paso6-estaciones.page.mjs';
import { Paso7FacturaPage } from './pages/paso7-factura.page.mjs';
import { Paso8ValidacionPage } from './pages/paso8-validacion.page.mjs';
import { Paso9RevisionPage } from './pages/paso9-revision.page.mjs';
import { ProviderFailureTracker, selectProviderRecord } from './utils/provider-failover.mjs';
import { describeValidationFailure } from './utils/validation-failure.mjs';

const MAX_AI_RETRIES = 3;
const MAX_RESTARTS = 3;
const MAX_FORM_RETRIES = 1;

export class CargaExpressBot {
  constructor({ driver, store, baseUrl, email, password, limit, rowFilter }) {
    this.driver = driver;
    this.store = store;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.expressUrl = `${this.baseUrl}/peajes/carga-express`;
    this.email = email;
    this.password = password;
    this.limit = limit ?? Infinity;
    this.rowFilter = rowFilter ?? null;
    this.parked = [];
    this.processed = 0;
    this.providerFailures = new ProviderFailureTracker(5);
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
    const records = this.store.records.filter((record) => {
      if (!isRetryableStatus(record)) return false;
      if (this.rowFilter && String(record.numero) !== String(this.rowFilter)) return false;
      if (this.parked.some((item) => item.key === rowKey(record))) return false;
      return true;
    });

    const selected = selectProviderRecord(records, (record) => this.providerFailures.isBlocked(record));
    if (selected && this.providerFailures.isBlocked(selected)) {
      console.log(`Todos los proveedores pendientes están bloqueados; continúo con ${selected.Empresa || '(sin proveedor)'}.`);
    }
    return selected ? [selected, ...records.filter((record) => record !== selected)] : [];
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
      const pending = this.pendingRecords();
      if (!pending.length) {
        if (!this.parked.length) break;
        console.log(`Esperando ${this.parked.length} fila(s) en USER_INPUT…`);
        await this.driver.sleep(8000);
        continue;
      }
      const record = pending[0];
      const handle = await this.openRowTab();
      try {
        const outcome = await this.processRecord(record, { handle, restarts: 0 });
        if (outcome === 'parked') continue;
        if (outcome === 'complete' || outcome === 'failed') this.processed += 1;
        await closeHandle(this.driver, handle);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.failRecord(record, message);
        this.processed += 1;
        await closeHandle(this.driver, handle).catch(() => {});
      }
    }

    if (this.parked.length) {
      console.log(`${this.parked.length} fila(s) quedan en USER_INPUT. El navegador sigue abierto para que las completes.`);
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

  async processRecord(record, { handle, restarts, formRetries = 0 }) {
    await switchToHandle(this.driver, handle);
    console.log(`\n→ ${record.numero} (${record.Empresa} / ${record.Template})`);
    updateRecordStatus(this.store, record, 'IN_PROGRESS', 'Procesando carga-express…');

    const pasadas = resolveRepoPath(record.filePasadasPath);
    const factura = resolveRepoPath(record.fileFacturaPath);
    if (!pasadas || !fs.existsSync(pasadas)) {
      this.failRecord(record, `No existe filePasadasPath: ${record.filePasadasPath}`);
      return 'failed';
    }
    if (!factura || !fs.existsSync(factura)) {
      this.failRecord(record, `No existe fileFacturaPath: ${record.fileFacturaPath}`);
      return 'failed';
    }

    let step = await this.pages.base.detectStep();
    if (step === 'unknown') {
      step = await this.pages.base.waitUntilKnownStep(45000);
    }
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

    await this.pages.paso1.uploadFiles(pasadas, factura);
    try {
      await this.pages.paso1.selectEmpresa(record.Empresa);
      await this.pages.paso1.selectPlantilla(record.Template);
    } catch (error) {
      const message =
        `Paso 1: no pude seleccionar Empresa «${record.Empresa}» o Plantilla «${record.Template}». ` +
        `${error instanceof Error ? error.message : error} Escribí el valor en el buscador y elegí la opción correcta, luego pulsá Aplicar plantilla.`;
      return this.park(record, handle, 'carga', message);
    }
    step = await this.pages.paso1.continueToNext();
    return this.continueFromStep(record, { handle, restarts, formRetries, step });
  }

  async continueFromStep(record, { handle, restarts, formRetries = 0, step }) {
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
      const facturaResult = await this.fillFactura(record, { handle, restarts });
      if (facturaResult?.kind === 'form-invalid') {
        const message = `Paso Factura inválido: ${facturaResult.message || 'el formulario no puede continuar.'}`;
        if (formRetries < MAX_FORM_RETRIES) {
          console.log(`RETRY ${record.numero}: ${message} Reiniciando la fila (${formRetries + 1}/${MAX_FORM_RETRIES}).`);
          await this.driver.navigate().refresh();
          await this.driver.sleep(1500);
          return this.processRecord(record, { handle, restarts, formRetries: formRetries + 1 });
        }
        this.failRecord(record, `${message} Falló también el reintento automático.`);
        return 'failed';
      }
      if (facturaResult === 'restart') {
        if (restarts + 1 >= MAX_RESTARTS) {
          return this.park(
            record,
            handle,
            'factura',
            'La IA de factura falló después de 3 reintentos y 3 recargas. Completá Número, Fecha, Subtotal, Percepciones, IVA y Total a mano y pulsá Continuar.',
          );
        }
        await this.driver.navigate().refresh();
        await this.driver.sleep(1500);
        return this.processRecord(record, { handle, restarts: restarts + 1 });
      }
      if (facturaResult === 'parked') return 'parked';
      current = await this.pages.base.detectStep();
    }

    if (current === 'validacion') {
      const state = await this.pages.validacion.continue();
      if (state.skipped) {
        current = await this.pages.base.detectStep();
      } else if (!state.enabled) {
        const validationFailure = describeValidationFailure(state);
        this.failRecord(
          record,
          `${validationFailure.message} Diferencia de factura o errores de filas detectados; se continúa con la siguiente fila.`,
        );
        return 'failed';
        return this.park(
          record,
          handle,
          'validacion',
          `Paso Validación bloqueado (${state.status || 'Requiere revisión'}). Revisá la diferencia de factura o los errores de filas y pulsá Continuar cuando esté verde.`,
        );
      } else {
        current = await this.pages.base.waitForStepChange('validacion', 30000);
      }
    }

    if (current === 'revision') {
      await this.pages.revision.confirm();
      updateRecordStatus(this.store, record, STATUS.COMPLETE, '');
      this.providerFailures.recordSuccess(record);
      console.log(`COMPLETE ${record.numero}`);
      return 'complete';
    }

    return this.park(
      record,
      handle,
      current,
      `El wizard quedó en el paso «${current}» y no puedo continuar solo. Necesito que revises la pantalla.`,
    );
  }

  async fillFactura(record, { handle, restarts }) {
    let retries = 0;
    while (retries <= MAX_AI_RETRIES) {
      const state = await this.pages.factura.waitAiSettled();
      if (state === 'error') {
        retries += 1;
        if (retries > MAX_AI_RETRIES) return 'restart';
        const clicked = await this.pages.factura.clickRetry();
        if (!clicked) return 'restart';
        continue;
      }
      break;
    }

    await this.pages.factura.fillFromRow(record);
    let result;
    try {
      result = await this.pages.factura.continueIfValid();
    } catch (error) {
      return { kind: 'form-invalid', message: error instanceof Error ? error.message : String(error) };
    }
    if (!result.ok) {
      return { kind: 'form-invalid', message: result.message || result.missing?.join(', ') || 'formulario inválido' };
    }
    if (!result.ok) {
      const message =
        `Paso Factura: faltan o fallan ${result.missing.join(', ')}. ` +
        `Usá numero=${record.numero}, fecha=${record.fechaEmision}, total=${record.monto}. ` +
        'Priorizá la sugerencia IA con más confianza si coincide. Cuando esté completo, pulsá Continuar.';
      return this.park(record, handle, 'factura', message);
    }
    try {
      await this.pages.base.waitForStepChange('factura', 90000);
    } catch (error) {
      return {
        kind: 'form-invalid',
        message: `El wizard no avanzó desde Paso 7: ${error instanceof Error ? error.message : error}`,
      };
    }
    return 'ok';
  }

  failRecord(record, message) {
    const count = this.providerFailures.recordFailure(record);
    updateRecordStatus(this.store, record, STATUS.FAILED, message);
    console.error(`FAILED ${record.numero} [${record.Empresa || '(sin proveedor)'}: ${count} consecutivo(s)]: ${message}`);
    if (count >= this.providerFailures.blockAfter) {
      console.log(`Proveedor ${record.Empresa || '(sin proveedor)'} queda temporalmente bloqueado tras ${count} fallos consecutivos.`);
    }
  }

  park(record, handle, stage, message) {
    updateRecordStatus(this.store, record, STATUS.USER_INPUT, message);
    const key = rowKey(record);
    const entry = { key, record, handle, stage, restarts: 0 };
    const index = this.parked.findIndex((item) => item.key === key);
    if (index >= 0) this.parked[index] = entry;
    else this.parked.push(entry);
    notifyUser(`Carga express — ayuda ${record.numero}`, message);
    console.log(`USER_INPUT ${record.numero}: ${message}`);
    return 'parked';
  }

  async finishParkedOutcome(item, outcome, keep) {
    if (outcome === 'parked') {
      keep.push(this.parked.find((entry) => entry.key === item.key) ?? item);
      return;
    }
    if (outcome === 'complete' || outcome === 'failed') {
      this.processed += 1;
      await closeHandle(this.driver, item.handle).catch(() => {});
    }
  }

  async pollParked() {
    const items = [...this.parked];
    const keep = [];
    for (const item of items) {
      try {
        await switchToHandle(this.driver, item.handle);
      } catch {
        continue;
      }
      const step = await this.pages.base.detectStep();
      const resumeFromPatentesOrStations =
        (item.stage === 'estaciones' || item.stage === 'patentes') &&
        ['factura', 'validacion', 'revision'].includes(step);
      const resumeFromFactura = item.stage === 'factura' && ['validacion', 'revision'].includes(step);
      const resumeFromValidacion = item.stage === 'validacion' && step === 'revision';

      if (item.stage === 'factura' && step === 'factura') {
        const result = await this.pages.factura.continueIfValid();
        if (result.ok) {
          const next = await this.pages.base.waitForStepChange('factura', 30000);
          const outcome = await this.continueFromStep(item.record, {
            handle: item.handle,
            restarts: item.restarts ?? 0,
            step: next,
          });
          await this.finishParkedOutcome(item, outcome, keep);
          continue;
        }
      }

      if (resumeFromPatentesOrStations || resumeFromFactura || resumeFromValidacion) {
        console.log(`Reanudando ${item.record.numero} desde ${step}`);
        const outcome = await this.continueFromStep(item.record, {
          handle: item.handle,
          restarts: item.restarts ?? 0,
          step,
        });
        await this.finishParkedOutcome(item, outcome, keep);
        continue;
      }
      keep.push(item);
    }
    this.parked = keep;
  }
}
