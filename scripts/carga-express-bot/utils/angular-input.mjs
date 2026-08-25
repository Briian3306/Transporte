/**
 * Set an Angular reactive-form input. If `element` is a wrapper (e.g. the
 * password container div), the first nested input/textarea is used.
 */
export async function setAngularInput(driver, element, value) {
  await driver.executeScript(
    `
    let input = arguments[0];
    const value = arguments[1] == null ? '' : String(arguments[1]);
    if (input && input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA') {
      input = input.querySelector('input, textarea');
    }
    if (!input) throw new Error('No se encontró un input dentro del elemento XPath');
    input.scrollIntoView({ block: 'center' });
    input.focus();
    input.click();
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor.set.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    descriptor.set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    `,
    element,
    value,
  );
}

export async function resolveInput(element) {
  const tag = await element.getTagName();
  if (tag === 'input' || tag === 'textarea') return element;
  return element.findElement({ css: 'input, textarea' });
}
