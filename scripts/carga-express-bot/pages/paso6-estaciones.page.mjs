import { By } from 'selenium-webdriver';
import { selectSearchOption } from '../utils/search-select.mjs';
import { BasePage } from './base.page.mjs';

const STATION_INPUT_XPATH = (rowIndex) =>
  `/html/body/app-root/div/main/app-peajes-carga-express/div/section/app-paso6-estaciones/div/div[2]/div/div/div[2]/div/table/tbody/tr[${rowIndex}]/td[3]/app-search-select`;
const CONTINUAR_XPATH =
  '/html/body/app-root/div/main/app-peajes-carga-express/div/section/app-paso6-estaciones//div[contains(@class,"pw__footer")]//button[contains(@class,"pw__btn--primary")]';

export class Paso6EstacionesPage extends BasePage {
  get table() {
    return this.byCss('.paso6__relation');
  }

  get recognizing() {
    return this.byCss('app-paso6-estaciones app-loading-spinner');
  }

  get rows() {
    return this.byCss('.paso6__relation tbody tr');
  }

  get reco() {
    return this.byCss('.paso6__reco');
  }

  get continuar() {
    return this.byXpath(CONTINUAR_XPATH);
  }

  async waitReady(timeout = 90000) {
    // While reconociendo is true, Angular does not render .paso6__relation.
    // Recognition can also finish and jump to Factura before the table appears.
    await this.driver.wait(async () => {
      const step = await this.detectStep();
      if (step !== 'estaciones') return true;
      if (await this.present(this.recognizing)) return false;
      return this.present(this.table);
    }, timeout);
  }

  async inspectRows() {
    await this.waitReady();
    if ((await this.detectStep()) !== 'estaciones') return [];
    const rows = await this.finds(this.rows);
    const result = [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const codigo = (await row.findElement(By.css('.paso6__codigo, .paso6__col-codigo')).getText()).trim();
      const reco = (await row.findElements(By.css('.paso6__reco'))).length > 0;
      const chips = await row.findElements(By.css('.paso6__sug .pw__chip'));
      const chipLabels = [];
      for (const chip of chips) chipLabels.push((await chip.getText()).trim());
      const compact = await row.findElements(By.css('.paso6__compact-name'));
      const assigned = compact.length ? (await compact[0].getText()).trim() : '';
      const search = await row.findElements(By.css('app-search-select'));
      result.push({
        row,
        rowIndex: index + 1,
        codigo,
        reco,
        chips: chipLabels,
        assigned,
        needsSelect: search.length > 0 && !assigned,
      });
    }
    return result;
  }

  async tryMatchRow(entry) {
    if (entry.assigned && !entry.reco) return { ok: true, codigo: entry.codigo };
    if (entry.reco && !entry.chips.length) {
      return { ok: false, codigo: entry.codigo, reason: 'sin coincidencia de catálogo' };
    }

    const codigo = entry.codigo.split('\n')[0].trim();
    const exactChip = entry.chips.find((label) => label.toLowerCase().includes(codigo.toLowerCase()));
    if (exactChip && entry.chips.length === 1) {
      const chips = await entry.row.findElements(By.css('.paso6__sug .pw__chip'));
      if (chips[0]) await chips[0].click();
      return { ok: true, codigo };
    }

    const selects = await this.driver.findElements(this.byXpath(STATION_INPUT_XPATH(entry.rowIndex)));
    if (!selects.length) {
      return entry.assigned ? { ok: true, codigo } : { ok: false, codigo, reason: 'sin selector de estación' };
    }

    try {
      await selectSearchOption(this.driver, selects[0], codigo, { timeout: 8000 });
      return { ok: true, codigo };
    } catch {
      return { ok: false, codigo, reason: 'no hay estación que coincida con el código proveedor' };
    }
  }

  async resolveOrReport() {
    await this.waitReady();
    if ((await this.detectStep()) !== 'estaciones') {
      return { ok: true, unresolved: [], skipped: true };
    }
    const inspected = await this.inspectRows();
    const unresolved = [];
    for (const entry of inspected) {
      const result = await this.tryMatchRow(entry);
      if (!result.ok) unresolved.push(result);
    }
    if (unresolved.length) return { ok: false, unresolved };
    await this.click(this.continuar);
    return { ok: true, unresolved: [] };
  }
}
