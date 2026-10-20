import { parsePositiveId } from './parse-positive-id';

describe('parsePositiveId', () => {
  it('accepts a whole number above zero', () => {
    expect(parsePositiveId('1')).toBe(1);
    expect(parsePositiveId('999999')).toBe(999999);
  });

  it.each([null, undefined, '', '0', '-3', '1.5', '12abc', 'abc', 'new', ' 7', '1e3', '99999999999999999999'])(
    'rejects %j', (value) => {
      expect(parsePositiveId(value)).toBeNull();
    });
});
