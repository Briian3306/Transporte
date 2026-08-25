import { By, Key, until } from 'selenium-webdriver';

export function pickOptionIndex(labels, query) {
  const needle = String(query).trim().toLowerCase();
  const idx = labels.findIndex((label) => {
    const text = String(label ?? '')
      .trim()
      .toLowerCase();
    return text === needle || text.includes(needle) || needle.includes(text);
  });
  return idx >= 0 ? idx : 0;
}

export function isStaleError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /stale element/i.test(message);
}

async function resolveRoot(rootOrFn) {
  return typeof rootOrFn === 'function' ? rootOrFn() : rootOrFn;
}

export async function selectSearchOption(driver, rootOrFn, query, { timeout = 20000 } = {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const root = await resolveRoot(rootOrFn);
      const input = await root.findElement(By.xpath('.//input'));
      await driver.wait(until.elementIsVisible(input), Math.min(8000, deadline - Date.now()));
      await input.click();
      await input.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
      await input.sendKeys(query);
      await driver.wait(async () => {
        const liveRoot = await resolveRoot(rootOrFn);
        const options = await liveRoot.findElements(
          By.xpath('.//ul[contains(@class,"ss__dropdown")]//li[contains(@class,"ss__option")]'),
        );
        return options.length > 0;
      }, Math.min(12000, deadline - Date.now()));

      const liveRoot = await resolveRoot(rootOrFn);
      const options = await liveRoot.findElements(
        By.xpath('.//ul[contains(@class,"ss__dropdown")]//li[contains(@class,"ss__option")]'),
      );
      const labels = [];
      for (const option of options) {
        labels.push((await option.getText()).trim());
      }
      const idx = pickOptionIndex(labels, query);
      const chosenLabel = labels[idx] ?? '';
      await driver.executeScript(
        'arguments[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); arguments[0].click();',
        options[idx],
      );
      await driver.wait(async () => {
        const chipRoot = await resolveRoot(rootOrFn);
        const chips = await chipRoot.findElements(By.css('.ss__value'));
        if (!chips.length) return false;
        const text = (await chips[0].getText()).trim().toLowerCase();
        const needle = String(query).trim().toLowerCase();
        return text.includes(needle) || needle.includes(text);
      }, Math.min(8000, deadline - Date.now()));
      return chosenLabel;
    } catch (error) {
      lastError = error;
      if (!isStaleError(error) && Date.now() >= deadline) throw error;
      if (!isStaleError(error) && !/timeout|waiting/i.test(error instanceof Error ? error.message : String(error))) {
        throw error;
      }
      await driver.sleep(250);
    }
  }
  throw lastError ?? new Error(`No se pudo seleccionar «${query}» en search-select`);
}

export async function findSearchSelectByAria(driver, ariaSubstring, { timeout = 12000 } = {}) {
  const locators = [
    By.css(`app-search-select input[aria-label*="${ariaSubstring}"]`),
    By.xpath(`//app-search-select[.//label[contains(., "${ariaSubstring}")]]`),
  ];
  let lastError;
  for (const locator of locators) {
    try {
      const input = await driver.wait(until.elementLocated(locator), timeout);
      return input.findElement(By.xpath('./ancestor::app-search-select[1]'));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`No se encontró app-search-select para "${ariaSubstring}"`);
}
