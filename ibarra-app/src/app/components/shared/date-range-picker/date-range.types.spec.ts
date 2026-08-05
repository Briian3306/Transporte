import {
  formatDateInputDisplay,
  parseFlexibleDateInput,
  parseFlexibleDateRangeInput,
} from './date-range.types';

describe('flexible date input parsing', () => {
  it('parses Argentine day/month/year variants', () => {
    const a = parseFlexibleDateInput('13/6/2020');
    expect(a?.getFullYear()).toBe(2020);
    expect(a?.getMonth()).toBe(5);
    expect(a?.getDate()).toBe(13);

    const b = parseFlexibleDateInput('13/06/2020');
    expect(b?.getDate()).toBe(13);

    const c = parseFlexibleDateInput('13-6-2020');
    expect(c?.getMonth()).toBe(5);

    const d = parseFlexibleDateInput('2020-06-13');
    expect(d?.getDate()).toBe(13);
  });

  it('formats display as dd/MM/yyyy', () => {
    expect(formatDateInputDisplay(new Date(2020, 5, 13))).toBe('13/06/2020');
  });

  it('rejects impossible calendar dates', () => {
    expect(parseFlexibleDateInput('31/02/2020')).toBeNull();
    expect(parseFlexibleDateInput('abc')).toBeNull();
  });

  it('parses typed ranges with spaced hyphen or en-dash', () => {
    const range = parseFlexibleDateRangeInput('13/6/2020 – 20/6/2020');
    expect(range.from?.getDate()).toBe(13);
    expect(range.to?.getDate()).toBe(20);

    const hyphen = parseFlexibleDateRangeInput('13/6/2020 - 20/6/2020');
    expect(hyphen.to?.getDate()).toBe(20);
  });
});
