import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob } from './download-blob';

describe('downloadBlob', () => {
  afterEach(() => vi.restoreAllMocks());

  it('clicks a download link for the blob and then releases its URL', () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-1');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe('blob:pdf-1');
      expect(this.download).toBe('INV-00012.pdf');
    });
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });

    downloadBlob(blob, 'INV-00012.pdf');

    expect(create).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:pdf-1');
    vi.useRealTimers();
  });
});
