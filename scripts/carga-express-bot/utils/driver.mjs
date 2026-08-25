import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

export async function createDriver() {
  const options = new chrome.Options();
  options.addArguments(
    '--disable-dev-shm-usage',
    '--disable-notifications',
    '--disable-infobars',
    '--disable-save-password-bubble',
    '--window-size=1440,960',
    '--start-maximized',
  );
  options.excludeSwitches('enable-automation', 'enable-logging');
  options.setUserPreferences({
    credentials_enable_service: false,
    'profile.password_manager_enabled': false,
  });

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 60000, script: 30000 });
  return driver;
}

export async function openNewTab(driver, url) {
  await driver.switchTo().newWindow('tab');
  const handle = await driver.getWindowHandle();
  await driver.get(url);
  return handle;
}

export async function switchToHandle(driver, handle) {
  await driver.switchTo().window(handle);
}

export async function closeHandle(driver, handle) {
  const handles = await driver.getAllWindowHandles();
  if (!handles.includes(handle)) return;
  await driver.switchTo().window(handle);
  if (handles.length === 1) {
    await driver.get('about:blank');
    return;
  }
  await driver.close();
  const remaining = (await driver.getAllWindowHandles()).filter((item) => item !== handle);
  if (remaining.length) await driver.switchTo().window(remaining[0]);
}
