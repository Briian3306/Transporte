import { BasePage } from './base.page.mjs';

export class Paso9RevisionPage extends BasePage {
  get host() {
    return this.byCss('app-paso9-revision');
  }

  get confirmar() {
    return this.byCss(
      'app-paso9-revision button[data-testid="confirmar-carga"], app-paso9-revision .pw__head button.pw__btn--success',
    );
  }

  get error() {
    return this.byCss('app-paso9-revision .pw__alert--error');
  }

  get successDialog() {
    return this.byCss('app-paso9-revision app-dialog, app-dialog .pw__btn--primary');
  }

  async confirm() {
    const button = await this.visible(this.confirmar, 20000);
    await this.driver.executeScript(
      'arguments[0].scrollIntoView({block: "center", inline: "center"});',
      button,
    );
    await this.driver.wait(async () => {
      const current = await this.find(this.confirmar, 1000);
      return (await current.isEnabled()) && (await current.isDisplayed());
    }, 20000);
    await this.click(this.confirmar);
    await this.driver.wait(async () => {
      const error = (await this.textOf(this.error)).trim();
      if (error) throw new Error(error);
      const confirmed = await this.present(this.byCss('app-paso9-revision .pw__status--valid'));
      const dialog = await this.present(this.successDialog);
      const statusText = (await this.textOf(this.byCss('app-paso9-revision .pw__status'))).trim();
      return dialog || /Carga confirmada/i.test(statusText) || confirmed;
    }, 60000);
    const again = await this.finds(this.byCss('app-dialog .pw__btn--primary'));
    for (const button of again) {
      const text = (await button.getText()).trim();
      if (/Cargar otro archivo/i.test(text)) {
        await button.click();
        break;
      }
    }
  }
}
