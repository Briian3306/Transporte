import { By, Key, until } from 'selenium-webdriver';
import { isLoginUrl, pagePath } from '../utils/urls.mjs';

export class BasePage {
  constructor(driver, timeout = 15000) {
    this.driver = driver;
    this.timeout = timeout;
  }

  byCss(selector) {
    return By.css(selector);
  }

  byXpath(xpath) {
    return By.xpath(xpath);
  }

  async find(locator, timeout = this.timeout) {
    return this.driver.wait(until.elementLocated(locator), timeout);
  }

  async finds(locator) {
    return this.driver.findElements(locator);
  }

  async visible(locator, timeout = this.timeout) {
    const element = await this.find(locator, timeout);
    await this.driver.wait(until.elementIsVisible(element), timeout);
    return element;
  }

  async click(locator, timeout = this.timeout) {
    const element = await this.visible(locator, timeout);
    await this.driver.wait(until.elementIsEnabled(element), timeout);
    try {
      await element.click();
    } catch {
      await this.driver.executeScript('arguments[0].click();', element);
    }
    return element;
  }

  async type(locator, text, { clear = true } = {}) {
    const element = await this.visible(locator);
    if (clear) {
      await element.click();
      await element.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
    }
    if (text != null && text !== '') await element.sendKeys(String(text));
    return element;
  }

  async present(locator) {
    return (await this.driver.findElements(locator)).length > 0;
  }

  async waitGone(locator, timeout = this.timeout) {
    await this.driver.wait(async () => !(await this.present(locator)), timeout);
  }

  async textOf(locator, timeout = this.timeout) {
    if (!(await this.present(locator))) return '';
    return (await this.find(locator, timeout)).getText();
  }

  async sleep(ms) {
    await this.driver.sleep(ms);
  }

  async currentUrl() {
    return this.driver.getCurrentUrl();
  }

  async detectStep() {
    const url = await this.currentUrl();
    if (isLoginUrl(url) || (await this.present(this.byXpath('/html/body/app-root/div/main/app-login')))) {
      return 'login';
    }
    if (pagePath(url).includes('access-denied') || url.includes('access-denied')) return 'denied';

    // Express mode keeps one wrapper section mounted while Angular swaps the
    // active child component. Read the wrapper's data-paso first so Paso 6 and
    // Paso 8 are never skipped during that render transition.
    const activePaso = await this.finds(this.byCss('app-peajes-carga-express section.pwe__card[data-paso]'));
    if (activePaso.length) {
      const paso = await activePaso[0].getAttribute('data-paso');
      const expressSteps = {
        '1': 'carga',
        '5': 'patentes',
        '6': 'estaciones',
        '7': 'factura',
        '8': 'validacion',
        '9': 'revision',
      };
      if (expressSteps[paso]) return expressSteps[paso];
    }

    if (await this.present(this.byCss('app-patentes-express'))) return 'patentes';
    if (await this.present(this.byCss('app-paso6-estaciones'))) return 'estaciones';
    if (await this.present(this.byCss('app-paso7-factura'))) return 'factura';
    if (await this.present(this.byCss('app-paso8-validacion'))) return 'validacion';
    if (await this.present(this.byCss('app-paso9-revision'))) return 'revision';
    if (await this.present(this.byCss('app-paso1-carga'))) return 'carga';
    return 'unknown';
  }

  async waitUntilKnownStep(timeout = 45000) {
    await this.driver.wait(async () => {
      const step = await this.detectStep();
      return step !== 'unknown';
    }, timeout);
    return this.detectStep();
  }

  async waitForStepChange(from, timeout = 60000) {
    await this.driver.wait(async () => {
      const step = await this.detectStep();
      return step !== from && step !== 'unknown';
    }, timeout);
    return this.detectStep();
  }

  async clickPrimaryFooter(hostCss) {
    const locator = this.byCss(`${hostCss} .pw__footer .pw__btn--primary, ${hostCss} .pw__head .pw__btn--success`);
    await this.click(locator);
  }

  async sendShiftEnter() {
    await this.driver.actions({ async: true }).keyDown(Key.SHIFT).sendKeys(Key.ENTER).keyUp(Key.SHIFT).perform();
  }
}
