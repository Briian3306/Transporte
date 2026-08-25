import { BasePage } from './base.page.mjs';

export class Paso8ValidacionPage extends BasePage {
  get host() {
    return this.byCss('app-paso8-validacion');
  }

  get loading() {
    return this.byCss('app-paso8-validacion .pw__alert--info');
  }

  get continuar() {
    return this.byCss('app-paso8-validacion .pw__footer .pw__btn--primary');
  }

  get status() {
    return this.byCss('app-paso8-validacion .pw__status');
  }

  async waitReady() {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const step = await this.detectStep();
      if (step === 'revision') return;
      if (await this.present(this.host)) break;
      await this.sleep(300);
    }
    if ((await this.detectStep()) !== 'validacion') return;
    if (await this.present(this.loading)) {
      await this.driver.wait(async () => {
        if ((await this.detectStep()) !== 'validacion') return true;
        const text = (await this.textOf(this.loading)).trim();
        return !/Ejecutando controles/i.test(text);
      }, 90000);
    }
    await this.sleep(400);
  }

  async canContinue() {
    await this.waitReady();
    if ((await this.detectStep()) !== 'validacion') {
      return { enabled: true, status: 'auto-avanzó a revisión', skipped: true };
    }
    if (!(await this.present(this.continuar))) {
      return { enabled: true, status: 'auto-avanzó a revisión', skipped: true };
    }
    const button = await this.find(this.continuar);
    const disabled = await button.getAttribute('disabled');
    const status = (await this.textOf(this.status)).trim();
    return { enabled: !disabled, status, skipped: false };
  }

  async continue() {
    const state = await this.canContinue();
    if (state.skipped) return state;
    if (!state.enabled) return state;
    await this.click(this.continuar);
    return state;
  }
}
