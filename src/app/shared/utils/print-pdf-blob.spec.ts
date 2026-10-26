import { printPdfBlob } from './print-pdf-blob';

describe('printPdfBlob', () => {
  let createUrl: ReturnType<typeof vi.spyOn>;
  let revoke: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    createUrl.mockRestore();
    revoke.mockRestore();
    document.querySelectorAll('iframe').forEach((f) => f.remove());
  });

  it('loads the PDF in a hidden frame and prints the frame, never opening a tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    printPdfBlob(new Blob(['%PDF'], { type: 'application/pdf' }), 'slip.pdf');

    const frame = document.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('blob:pdf');
    expect(frame.style.visibility).toBe('hidden');
    const print = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { focus: vi.fn(), print } });
    frame.dispatchEvent(new Event('load'));

    expect(print).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('downloads the file when the frame refuses to print', () => {
    printPdfBlob(new Blob(['%PDF'], { type: 'application/pdf' }), 'slip.pdf');
    const frame = document.querySelector('iframe')!;
    Object.defineProperty(frame, 'contentWindow', {
      value: { focus: vi.fn(), print: () => { throw new Error('blocked'); } },
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    frame.dispatchEvent(new Event('load'));

    expect(click).toHaveBeenCalled();
    expect(document.querySelector('iframe')).toBeNull();
    click.mockRestore();
  });
});
