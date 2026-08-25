import { Key } from 'selenium-webdriver';
import { resolveInput, setAngularInput } from '../utils/angular-input.mjs';
import { isLoginUrl, isPostLoginUrl } from '../utils/urls.mjs';
import { BasePage } from './base.page.mjs';

const EMAIL_XPATH = '/html/body/app-root/div/main/app-login/div/div/form/div[1]/input';
const PASSWORD_XPATH = '/html/body/app-root/div/main/app-login/div/div/form/div[2]/div';
const SUBMIT_XPATH = '/html/body/app-root/div/main/app-login/div/div/form//button[@type="submit"]';
const FORM_XPATH = '/html/body/app-root/div/main/app-login/div/div/form';

export class LoginPage extends BasePage {
  get form() {
    return this.byXpath(FORM_XPATH);
  }

  get email() {
    return this.byXpath(EMAIL_XPATH);
  }

  get password() {
    return this.byXpath(PASSWORD_XPATH);
  }

  get submit() {
    return this.byXpath(SUBMIT_XPATH);
  }

  get error() {
    return this.byCss('.general-error, .error-message.general-error');
  }

  async fillField(locator, value) {
    const host = await this.visible(locator, 20000);
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"});', host);
    await host.click();
    const input = await resolveInput(host);
    await setAngularInput(this.driver, input, value);
    await input.sendKeys(Key.END);
    const current = await input.getAttribute('value');
    if (current !== String(value)) {
      await input.click();
      await input.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
      await input.sendKeys(String(value));
    }
    return input;
  }

  async login(email, password) {
    console.log('Login detectado (incluye ?returnUrl=/peajes/carga-express). Completando formulario…');
    await this.fillField(this.email, email);
    await this.fillField(this.password, password);

    const form = await this.find(this.form);
    await this.sleep(300);
    await this.click(this.submit);
    await this.sleep(400);
    if (isLoginUrl(await this.currentUrl())) {
      await this.driver.executeScript(
        'const form = arguments[0]; if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));',
        form,
      );
    }

    await this.driver.wait(async () => {
      const url = await this.currentUrl();
      if (!isLoginUrl(url) && isPostLoginUrl(url)) return true;
      if (await this.present(this.error)) {
        const message = (await this.textOf(this.error)).trim();
        if (message) throw new Error(`Login falló: ${message}`);
      }
      return false;
    }, 30000);
    console.log(`Login OK, ahora en ${await this.currentUrl()}`);
  }
}
