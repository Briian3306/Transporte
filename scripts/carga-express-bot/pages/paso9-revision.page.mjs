import { BasePage } from './base.page.mjs';
import {
  REVISION_DIALOG_VIEW_MS,
  REVISION_SUCCESS_DIALOG_SELECTOR,
  REVISION_SUCCESS_DIALOG_XPATH,
  REVISION_UPLOAD_TIMEOUT_MS,
  revisionUploadSettled,
} from '../utils/revision-wait.mjs';

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
    return this.byCss(REVISION_SUCCESS_DIALOG_SELECTOR);
  }

  get successDialogXpath() {
    return this.byXpath(REVISION_SUCCESS_DIALOG_XPATH);
  }

  async successDialogOpen() {
    if (await this.present(this.successDialog)) return true;
    return this.present(this.successDialogXpath);
  }

  async confirm({ timeoutMs = REVISION_UPLOAD_TIMEOUT_MS, viewMs = REVISION_DIALOG_VIEW_MS } = {}) {
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

    const started = Date.now();
    let lastLog = 0;
    let settled = { done: false, ok: false };
    while (Date.now() - started < timeoutMs) {
      const dialogOpen = await this.successDialogOpen();
      const errorText = (await this.textOf(this.error)).trim();
      const statusText = (await this.textOf(this.byCss('app-paso9-revision .pw__status'))).trim();
      settled = revisionUploadSettled({ dialogOpen, statusText, errorText });
      const elapsedMs = Date.now() - started;
      if (lastLog === 0 || elapsedMs - lastLog >= 15000) {
        console.log(
          `[REVISION] waiting upload ${Math.round(elapsedMs / 1000)}s dialog=${dialogOpen} status="${statusText || '—'}"`,
        );
        lastLog = elapsedMs;
      }
      if (settled.done) break;
      await this.sleep(500);
    }

    if (!settled.done) {
      throw new Error(
        'La confirmación no terminó a tiempo. Esperá el diálogo «Carga confirmada» o el error en pantalla.',
      );
    }
    if (!settled.ok) {
      throw new Error(settled.error || 'No se pudo confirmar la carga');
    }

    console.log('[REVISION] diálogo Carga confirmada visible');
    if (viewMs > 0) await this.sleep(viewMs);
    await this.clickCargarOtro();
  }

  async clickCargarOtro() {
    const buttons = await this.finds(
      this.byCss('app-paso9-revision app-dialog .pw__btn--primary, app-dialog .pw__btn--primary'),
    );
    for (const button of buttons) {
      const text = (await button.getText()).trim();
      if (!/Cargar otro archivo/i.test(text)) continue;
      await this.driver.executeScript('arguments[0].click();', button);
      return;
    }
  }
}
