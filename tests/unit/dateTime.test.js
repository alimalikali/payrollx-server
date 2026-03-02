const { formatLocalDate, formatLocalTime } = require('../../src/utils/dateTime');

describe('dateTime utils', () => {
  it('formats date-like values using local calendar parts instead of UTC ISO output', () => {
    const fakeLocalDate = {
      getFullYear: () => 2026,
      getMonth: () => 2,
      getDate: () => 3,
      getHours: () => 0,
      getMinutes: () => 30,
      getSeconds: () => 15,
      getTime: () => 1,
      toISOString: () => '2026-03-02T19:30:15.000Z',
    };

    expect(formatLocalDate(fakeLocalDate)).toBe('2026-03-03');
    expect(formatLocalTime(fakeLocalDate)).toBe('00:30:15');
  });

  it('preserves plain YYYY-MM-DD values without reparsing them', () => {
    expect(formatLocalDate('2026-03-03')).toBe('2026-03-03');
  });
});
