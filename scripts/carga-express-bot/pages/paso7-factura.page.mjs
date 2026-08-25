import { By, Key } from 'selenium-webdriver';
import { amountsClose, datesMatch, formatDateInput, parseAmount } from '../utils/amounts.mjs';
import { setAngularInput } from '../utils/angular-input.mjs';
import { pickInvoiceNumber, stripInvoiceTypeLetters } from '../utils/invoice-number.mjs';
import { invoiceAiCanProceed } from '../utils/invoice-ai-wait.mjs';
import { describeInvoiceFormFailure } from '../utils/invoice-form-state.mjs';
import { BasePage } from './base.page.mjs';

export class Paso7FacturaPage extends BasePage {
  get host() {
    return this.byCss('app-paso7-factura');
  }

  get loader() {
    return this.byCss(
      '[data-testid="invoice-ai-loader"], app-paso7-factura .paso7__ai-loader, app-paso7-factura app-graph-loader',
    );
  }

  get retry() {
    return this.byCss('app-paso7-factura button');
  }

  get status() {
    return this.byCss('[data-testid="invoice-ai-status"]');
  }

  get continuar() {
    return this.byXpath(
      '/html/body/app-root/div/main/app-peajes-carga-express/div/section/app-paso7-factura//div[contains(@class,"pw__footer")]//button[contains(@class,"pw__btn--primary")]',
    );
  }

  field(id) {
    return this.byXpath(`//app-paso7-factura//input[@id="${id}"]`);
  }

  async waitAiSettled(timeout = 90000) {
    await this.find(this.host, 30000);
    const started = Date.now();
    let sawLoader = false;
    while (Date.now() - started < timeout) {
      const loading = await this.present(this.loader);
      if (loading) sawLoader = true;
      const state = await this.aiState();
      const elapsedMs = Date.now() - started;
      if (invoiceAiCanProceed({ loading, state, sawLoader, elapsedMs })) {
        await this.visible(this.field('factura'), 20000);
        return state;
      }
      await this.sleep(400);
    }
    return this.aiState();
  }

  async aiState() {
    if (await this.present(this.loader)) return 'loading';
    const status = (await this.textOf(this.status)).trim();
    if (/No se pudieron|error|Reintentar/i.test(status)) return 'error';
    if (/Sugerencias listas/i.test(status)) return 'ready';
    return 'idle';
  }

  async clickRetry() {
    const buttons = await this.finds(this.retry);
    for (const button of buttons) {
      const text = (await button.getText()).trim();
      if (/Reintentar análisis/i.test(text)) {
        await button.click();
        return true;
      }
    }
    return false;
  }

  async readChips(fieldId) {
    const field = await this.find(this.field(fieldId));
    const container = await field.findElement(By.xpath('./ancestor::div[contains(@class,"pw__field")][1]'));
    const chips = await container.findElements(By.css('.paso7__suggest'));
    const result = [];
    for (const chip of chips) {
      const value = (await chip.findElement(By.css('span')).getText()).trim();
      const small = (await chip.findElement(By.css('small')).getText()).trim();
      const percent = Number((small.match(/(\d+)\s*%/) || [])[1] ?? 0);
      result.push({ chip, value, confidence: percent / 100, label: small });
    }
    return result;
  }

  async clickHighestChip(fieldId, { match } = {}) {
    const chips = await this.readChips(fieldId);
    if (!chips.length) return false;
    const filtered = match ? chips.filter((item) => match(item)) : chips;
    if (!filtered.length) return false;
    filtered.sort((a, b) => b.confidence - a.confidence);
    await filtered[0].chip.click();
    await this.sleep(200);
    return true;
  }

  async fillInput(id, value) {
    const element = await this.visible(this.field(id));
    await setAngularInput(this.driver, element, value);
    await element.sendKeys(Key.TAB);
  }

  async readInput(id) {
    if (!(await this.present(this.field(id)))) return '';
    return this.find(this.field(id)).then((el) => el.getAttribute('value'));
  }

  async invalidFields() {
    const elements = await this.finds(this.byCss('app-paso7-factura .pw__field-error'));
    const errors = [];
    for (const element of elements) {
      const text = (await element.getText()).trim();
      if (text) errors.push(text);
    }
    return errors;
  }

  async invalidControls() {
    const elements = await this.finds(
      this.byCss('app-paso7-factura form input.ng-invalid, app-paso7-factura form select.ng-invalid, app-paso7-factura form textarea.ng-invalid'),
    );
    const fields = [];
    for (const element of elements) {
      const id = (await element.getAttribute('id'))?.trim();
      if (id) fields.push(id.replace(/_\d+$/, ''));
    }
    return [...new Set(fields)];
  }

  async fillFromRow(record) {
    const numeroChips = await this.readChips('factura');
    const picked = pickInvoiceNumber(
      numeroChips.map((chip) => ({ value: stripInvoiceTypeLetters(chip.value), confidence: chip.confidence })),
      record.numero,
    );
    const hyphenChip = numeroChips.find((chip) => stripInvoiceTypeLetters(chip.value) === picked);
    if (hyphenChip) await hyphenChip.chip.click();
    else if (picked) await this.fillInput('factura', picked);

    const expectedDate = formatDateInput(record.fechaEmision);
    const dateClicked = await this.clickHighestChip('fecha_factura', {
      match: (chip) => datesMatch(chip.value, expectedDate),
    });
    if (!dateClicked && expectedDate) await this.fillInput('fecha_factura', expectedDate);

    await this.clickHighestChip('importe_sin_iva');
    await this.clickHighestChip('percepciones');
    await this.clickHighestChip('iva');

    const expectedTotal = parseAmount(record.monto);
    const totalClicked = await this.clickHighestChip('importe_total', {
      match: (chip) => amountsClose(parseAmount(chip.value), expectedTotal),
    });
    if (!totalClicked && expectedTotal != null) await this.fillInput('importe_total', String(expectedTotal));
  }

  async missingRequired() {
    const missing = [];
    const factura = (await this.readInput('factura')).trim();
    const fecha = (await this.readInput('fecha_factura')).trim();
    const subtotal = (await this.readInput('importe_sin_iva')).trim();
    const total = (await this.readInput('importe_total')).trim();
    if (!factura) missing.push('Número de factura');
    if (!fecha) missing.push('Fecha de documento');
    if (!subtotal) missing.push('Subtotal');
    if (!total) missing.push('Total');
    return { missing, errors: await this.invalidFields(), invalidControls: await this.invalidControls() };
  }

  async continueIfValid() {
    const formState = await this.missingRequired();
    const failure = describeInvoiceFormFailure(formState);
    if (failure.invalid) return { ok: false, ...formState, ...failure };
    const button = await this.find(this.continuar);
    if (await button.getAttribute('disabled')) {
      return {
        ok: false,
        ...formState,
        invalid: true,
        message: 'El botón Continuar de Paso 7 está deshabilitado.',
      };
    }
    await this.click(this.continuar);
    return { ok: true, ...formState, ...failure };
  }
}
