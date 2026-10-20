import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadCsv } from './download-csv';

describe('downloadCsv', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads a BOM-prefixed CSV with formula text neutralised', async () => {
    let captured: Blob | null = null;
    let fileName = '';
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { captured = blob as Blob; return 'blob:csv'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { fileName = this.download; });

    downloadCsv([['Label', 'Amount'], ['a, b', '-12.50'], [], ['@x', '+1', 'extra']], 'deadlines-2026-10-19');

    expect(fileName).toBe('deadlines-2026-10-19.csv');
    const bytes = new Uint8Array(await captured!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes).replace(/^\uFEFF/, '').split('\r\n');
    expect(lines).toEqual(['Label,Amount', '"a, b",-12.50', '', '"\'@x","\'+1",extra']);
  });
});
