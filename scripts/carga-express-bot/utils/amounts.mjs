/** Parse Telepase / AR invoice amounts like `$4.386.978,42` into a JS number. */
export function parseAmount(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/[$€\s]/g, '');
  if (!text) return null;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  if (hasComma && hasDot) {
    text = text.replaceAll('.', '').replace(',', '.');
  } else if (hasComma) {
    text = text.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replaceAll('.', '');
  }

  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

export function amountsClose(a, b, tolerance = 0.02) {
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

export function formatDateInput(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  }
  return text;
}

export function datesMatch(a, b) {
  const left = formatDateInput(a);
  const right = formatDateInput(b);
  return Boolean(left && right && left === right);
}
