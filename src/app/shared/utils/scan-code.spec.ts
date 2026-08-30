import { hintScanKind } from './scan-code';

describe('hintScanKind', () => {
  it.each([
    ['JOB-1042', 'job'], ['prt-77', 'part'], ['LOC-A-01', 'bin'], ['LOT-2026-08', 'lot'],
    ['EMP-0007', 'badge'], ['SO-500', 'salesOrder'], ['PO-12', 'purchaseOrder'], ['AST-3', 'asset'],
  ])('maps the %s prefix to %s', (code, kind) => {
    expect(hintScanKind(code)).toBe(kind);
  });

  it('treats GS1-length digit strings as parts', () => {
    expect(hintScanKind('01234567')).toBe('part');
    expect(hintScanKind('012345678905')).toBe('part');
    expect(hintScanKind('0012345678905')).toBe('part');
  });

  it('recognises an enrollment payload and only that', () => {
    expect(hintScanKind('{"server":"https://shop.example","token":"abc"}')).toBe('enrollment');
    expect(hintScanKind('{"server":"https://shop.example"}')).toBe('unknown');
    expect(hintScanKind('{not json')).toBe('unknown');
  });

  it('is unknown for anything without a known prefix', () => {
    expect(hintScanKind('hello')).toBe('unknown');
    expect(hintScanKind('-JOB')).toBe('unknown');
    expect(hintScanKind('XYZ-1')).toBe('unknown');
  });
});
