import { findSearchSelectByAria, selectSearchOption } from '../utils/search-select.mjs';
import { BasePage } from './base.page.mjs';

const FILE_INPUT_CSS = 'app-paso1-carga .pw__drop input[type="file"]';
const CONTINUAR_XPATH =
  '/html/body/app-root/div/main/app-peajes-carga-express/div/section/app-paso1-carga/div/div[3]/div[2]/button';

export class Paso1CargaPage extends BasePage {
  get fileInput() {
    return this.byCss(FILE_INPUT_CSS);
  }

  get fileName() {
    return this.byCss('app-paso1-carga .paso1__file-name');
  }

  get pdfChip() {
    return this.byCss('app-paso1-carga .paso1__attached-pdf');
  }

  get continuar() {
    return this.byXpath(CONTINUAR_XPATH);
  }

  get applying() {
    return this.byCss('app-paso1-carga .pw__alert--info');
  }

  get errorAlert() {
    return this.byCss('app-paso1-carga .pw__alert--error');
  }

  get masivaOption() {
    return this.byXpath(
      '/html/body/app-root/div/main/app-peajes-carga-express/div/section/app-paso1-carga/div/div[2]/fieldset//label[contains(., "Importación masiva")]',
    );
  }

  get pdfListItems() {
    return this.byCss('app-paso1-carga .paso1__pdf-item');
  }

  async selectMasiva() {
    const option = await this.visible(this.masivaOption, 20000);
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"});', option);
    await option.click();
    await this.sleep(400);
    const radio = await option.findElement(this.byCss('input[type="radio"]'));
    const checked = await radio.getAttribute('checked');
    if (checked == null && !(await radio.isSelected())) {
      await this.driver.executeScript('arguments[0].click();', radio);
    }
  }

  async uploadMasiva(xlsxPath, pdfPaths = []) {
    const input = await this.find(this.fileInput, 20000);
    const paths = [xlsxPath, ...pdfPaths].filter(Boolean);
    await input.sendKeys(paths.join('\n'));
    await this.driver.wait(async () => {
      const name = (await this.textOf(this.fileName)).trim();
      return name && name !== 'Sin archivo';
    }, 30000);
    if (pdfPaths.length) {
      await this.driver.wait(async () => (await this.finds(this.pdfListItems)).length > 0, 30000);
    }
  }

  async uploadFiles(pasadasPath, facturaPath) {
    const input = await this.find(this.fileInput, 20000);
    const paths = [pasadasPath, facturaPath].filter(Boolean);
    await input.sendKeys(paths.join('\n'));
    await this.driver.wait(async () => {
      const name = (await this.textOf(this.fileName)).trim();
      return name && name !== 'Sin archivo';
    }, 30000);
    if (facturaPath) {
      await this.driver.wait(async () => this.present(this.pdfChip), 15000).catch(() => {});
    }
  }

  async selectEmpresa(nombre) {
    await selectSearchOption(
      this.driver,
      () => findSearchSelectByAria(this.driver, 'Empresa', { timeout: 20000 }),
      nombre,
      { timeout: 20000 },
    );
  }

  async selectPlantilla(nombre) {
    await selectSearchOption(
      this.driver,
      () => findSearchSelectByAria(this.driver, 'Plantilla', { timeout: 20000 }),
      nombre,
      { timeout: 20000 },
    );
  }

  async continueToNext(timeout = 90000) {
    const button = await this.visible(this.continuar);
    const disabled = await button.getAttribute('disabled');
    if (disabled) {
      const error = (await this.textOf(this.errorAlert)).trim();
      throw new Error(error || 'El botón Continuar de Paso 1 está deshabilitado.');
    }
    await button.click();
    try {
      await this.sendShiftEnter();
    } catch {
      /* Shift+Enter is optional; the footer button is the real advance. */
    }
    await this.driver.wait(async () => {
      const error = (await this.textOf(this.errorAlert)).trim();
      const step = await this.detectStep();
      if (error && step === 'carga') throw new Error(error);
      return step !== 'carga';
    }, timeout);
    return this.detectStep();
  }
}
