import { By, Key } from 'selenium-webdriver';
import { amountsClose, datesMatch, formatDateInput, parseAmount } from '../utils/amounts.mjs';
import { setAngularInput } from '../utils/angular-input.mjs';
import { pickInvoiceNumber, stripInvoiceTypeLetters } from '../utils/invoice-number.mjs';
import { invoiceAiCanProceed, INVOICE_AI_LOADER_SELECTOR } from '../utils/invoice-ai-wait.mjs';
import { invoiceAiMasivaCanProceed, invoiceAiMasivaShouldGiveUp, masivaAccordionPanelXpath, masivaAccordionTriggerXpath, summarizeMasivaBadgeNodes } from '../utils/invoice-ai-masiva-wait.mjs';
import { describeInvoiceFormFailure } from '../utils/invoice-form-state.mjs';
import { BasePage } from './base.page.mjs';

export class Paso7FacturaPage extends BasePage {
  get host() {
    return this.byCss('app-paso7-factura');
  }

  get loader() {
    return this.byCss(INVOICE_AI_LOADER_SELECTOR);
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

  get masivaHost() {
    return this.byXpath(
      '/html/body/app-root/div/main/app-peajes-carga-express/div/section/app-paso7-factura/div/div[2]/div',
    );
  }

  get masivaBadges() {
    return this.byCss('app-paso7-factura .paso7__acc-badge');
  }

  masivaPanel(index1) {
    return this.byXpath(masivaAccordionPanelXpath(index1));
  }

  masivaPanelTrigger(index1) {
    return this.byXpath(masivaAccordionTriggerXpath(index1));
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

  async suggestionChipCount() {
    return (await this.finds(this.byCss('app-paso7-factura .paso7__suggest'))).length;
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

  async masivaBadgeSnapshot() {
    const raw = await this.driver.executeScript(() => {
      const badges = [...document.querySelectorAll('app-paso7-factura .paso7__acc-badge')];
      const loader = document.querySelector(
        'app-paso7-factura [data-testid="invoice-ai-loader"], app-paso7-factura .paso7__ai-loader',
      );
      return {
        loaderVisible: Boolean(loader),
        nodes: badges.map((el) => ({
          className: String(el.className || ''),
          text: String(el.innerText || el.textContent || '').trim(),
        })),
      };
    });
    return summarizeMasivaBadgeNodes(raw?.nodes ?? [], { loaderVisible: Boolean(raw?.loaderVisible) });
  }

  async waitMasivaAiSettled(timeout = 480000, { expectedPdfs = 0 } = {}) {
    await this.find(this.host, 30000);
    const started = Date.now();
    let sawLoader = false;
    let idleSince = null;
    let lastLog = 0;
    let lastKeepLog = 0;
    while (true) {
      const snapshot = await this.masivaBadgeSnapshot();
      if (snapshot.loaderVisible || snapshot.loadingBadges > 0 || snapshot.idlePdfBadges > 0) {
        sawLoader = sawLoader || snapshot.loaderVisible || snapshot.loadingBadges > 0;
        idleSince = null;
      } else if (idleSince == null) {
        idleSince = Date.now();
      }
      const elapsedMs = Date.now() - started;
      const idleMs = idleSince == null ? 0 : Date.now() - idleSince;
      if (lastLog === 0 || elapsedMs - lastLog >= 15000) {
        console.log(
          `[AI] waiting ${Math.round(elapsedMs / 1000)}s ready=${snapshot.readyBadges} error=${snapshot.errorBadges} analyzing=${snapshot.loadingBadges} pdf=${snapshot.idlePdfBadges} loader=${snapshot.loaderVisible} idle=${Math.round(idleMs / 1000)}s expectedPdfs=${expectedPdfs}`,
        );
        lastLog = elapsedMs;
      }
      if (invoiceAiMasivaCanProceed(snapshot, { expectedPdfs, elapsedMs, idleMs, sawLoader })) {
        return { ...snapshot, timedOut: false, sawLoader, elapsedMs, idleMs };
      }
      if (invoiceAiMasivaShouldGiveUp(snapshot, { elapsedMs, timeoutMs: timeout })) {
        return { ...snapshot, timedOut: true, sawLoader, elapsedMs, idleMs };
      }
      if (elapsedMs >= timeout && elapsedMs - lastKeepLog >= 15000) {
        console.log('[AI] soft timeout passed but queue still running; keep waiting on this tab');
        lastKeepLog = elapsedMs;
      }
      await this.sleep(1000);
    }
  }

  async dismissTemplateRecommendation() {
    const buttons = await this.finds(this.byCss('app-paso7-factura .paso7__template-recommendation button'));
    for (const button of buttons) {
      const text = (await button.getText()).trim();
      if (/Ahora no/i.test(text)) {
        await this.driver.executeScript('arguments[0].click();', button);
        await this.sleep(200);
        return;
      }
    }
  }

  async masivaPanelCount() {
    return (await this.finds(this.byCss('app-paso7-factura .paso7__masiva app-accordion-panel'))).length;
  }

  async panelHasChildren(index1) {
    const panels = await this.driver.findElements(this.masivaPanel(index1));
    if (!panels.length) return false;
    const children = await panels[0].findElements(By.css('.pw__field, .paso7__form, button.paso7__suggest'));
    return children.length > 0;
  }

  async expandMasivaPanelAt(index1) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const trigger = await this.find(this.masivaPanelTrigger(index1), 15000);
      const expanded = await trigger.getAttribute('aria-expanded');
      if (expanded !== 'true') {
        await this.driver.executeScript(
          'arguments[0].scrollIntoView({block:"center"}); arguments[0].click();',
          trigger,
        );
        await this.sleep(700);
      }
      try {
        await this.driver.wait(async () => this.panelHasChildren(index1), 5000);
        return;
      } catch {
        /* retry expand */
      }
    }
    console.log(`[AI] panel ${index1} no children after expand`);
  }

  async clickHighestChipsInPanelAt(index1, total = index1) {
    await this.expandMasivaPanelAt(index1);
    const panels = await this.driver.findElements(this.masivaPanel(index1));
    if (!panels.length) {
      console.log(`[AI] panel ${index1}/${total} missing`);
      return 0;
    }
    const result = await this.driver.executeScript((root) => {
      const fields = [...root.querySelectorAll('.pw__field')];
      const suggestButtons = [...root.querySelectorAll('button.paso7__suggest')];
      let clicked = 0;
      for (const field of fields) {
        const chips = [...field.querySelectorAll('button.paso7__suggest')];
        if (!chips.length) continue;
        let best = chips[0];
        let bestPct = -1;
        for (const chip of chips) {
          const small = chip.querySelector('small')?.textContent || chip.textContent || '';
          const match = String(small).match(/(\d+)\s*%/);
          const pct = match ? Number(match[1]) : 0;
          if (pct >= bestPct) {
            bestPct = pct;
            best = chip;
          }
        }
        best.scrollIntoView({ block: 'center' });
        best.click();
        clicked += 1;
      }
      return { fields: fields.length, suggestButtons: suggestButtons.length, clicked };
    }, panels[0]);
    console.log(
      `[AI] panel ${index1}/${total} fields=${result?.fields ?? 0} suggestButtons=${result?.suggestButtons ?? 0} clicked=${result?.clicked ?? 0}`,
    );
    await this.sleep(250);
    return Number(result?.clicked ?? 0);
  }

  async applyMasivaSuggestionChips() {
    await this.dismissTemplateRecommendation();
    let totalClicked = 0;
    while (true) {
      const count = await this.masivaPanelCount();
      console.log(`[AI] accordion panels=${count}`);
      for (let index = 1; index <= count; index += 1) {
        totalClicked += await this.clickHighestChipsInPanelAt(index, count);
      }
      const nextButtons = await this.finds(this.byCss('app-paso7-factura .paso7__pager button'));
      let advanced = false;
      for (const button of nextButtons) {
        const text = (await button.getText()).trim();
        if (!/Siguiente/i.test(text)) continue;
        const disabled = await button.getAttribute('disabled');
        if (disabled) break;
        await this.driver.executeScript('arguments[0].click();', button);
        await this.sleep(500);
        advanced = true;
        break;
      }
      if (!advanced) break;
    }
    return totalClicked;
  }

  async masivaFormState() {
    const missing = [];
    const facturaInputs = await this.finds(this.byCss('app-paso7-factura input[id^="factura_"]'));
    for (const input of facturaInputs) {
      const id = (await input.getAttribute('id')) || '';
      const index = id.replace(/^factura_/, '');
      const factura = (await input.getAttribute('value'))?.trim() ?? '';
      const fecha = await this.readInput(`fecha_factura_${index}`);
      const subtotal = await this.readInput(`importe_sin_iva_${index}`);
      const total = await this.readInput(`importe_total_${index}`);
      if (!factura) missing.push(`Número de factura (${id})`);
      if (!String(fecha ?? '').trim()) missing.push(`Fecha de documento (${index})`);
      if (!String(subtotal ?? '').trim()) missing.push(`Subtotal (${index})`);
      if (!String(total ?? '').trim()) missing.push(`Total (${index})`);
    }
    return {
      missing,
      errors: await this.invalidFields(),
      invalidControls: await this.invalidControls(),
    };
  }

  async continueIfValidMasiva() {
    await this.dismissTemplateRecommendation();
    const button = await this.find(this.continuar);
    if (await button.getAttribute('disabled')) {
      return {
        ok: false,
        invalid: true,
        message: 'El botón Continuar de Paso 7 está deshabilitado.',
        ...(await this.masivaFormState()),
      };
    }
    await this.driver.executeScript(
      'arguments[0].scrollIntoView({block:"center"}); arguments[0].click();',
      button,
    );
    await this.sleep(1200);
    const step = await this.detectStep();
    if (step !== 'factura' && step !== 'unknown') {
      return { ok: true, step };
    }
    return {
      ok: false,
      invalid: true,
      message: 'Sigue en Paso 7 después de Continuar.',
      step,
      ...(await this.masivaFormState()),
    };
  }
}
