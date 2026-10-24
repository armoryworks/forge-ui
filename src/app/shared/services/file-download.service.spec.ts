import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileDownloadService } from './file-download.service';

describe('FileDownloadService', () => {
  let service: FileDownloadService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FileDownloadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function spyDownloads(): string[] {
    const names: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:file');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    return names;
  }

  function fakeTab(): Window {
    return { closed: false, close: vi.fn(), location: { href: '' } } as unknown as Window;
  }

  it('opens the tab before the fetch and points it at the fetched blob', () => {
    vi.useFakeTimers();
    const tab = fakeTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:po-1');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    service.open('/api/v1/orders/7/customer-po/pdf', 'customer-po-7.pdf');

    expect(open).toHaveBeenCalledWith('', '_blank');
    const req = http.expectOne('/api/v1/orders/7/customer-po/pdf');
    expect(req.request.responseType).toBe('blob');
    expect(tab.location.href).toBe('');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));

    expect(tab.location.href).toBe('blob:po-1');
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:po-1');
  });

  it('downloads the file when the tab was blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const downloads = spyDownloads();

    service.open('/api/v1/files/3/download', 'spec.pdf');
    http.expectOne('/api/v1/files/3/download').flush(new Blob(['%PDF'], { type: 'application/pdf' }));

    expect(downloads).toEqual(['spec.pdf']);
  });

  it('closes the empty tab when the fetch fails', () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab);

    service.open('/api/v1/files/4/download', 'gone.pdf');
    http.expectOne('/api/v1/files/4/download').flush(new Blob(), { status: 404, statusText: 'Not Found' });

    expect(tab.close).toHaveBeenCalled();
  });

  it('downloads non-viewable files without opening a tab', () => {
    const open = vi.spyOn(window, 'open');
    const downloads = spyDownloads();

    service.openOrDownload('/api/v1/files/5/download', 'drawing.step', 'application/step');
    http.expectOne('/api/v1/files/5/download').flush(new Blob(['x']));

    expect(open).not.toHaveBeenCalled();
    expect(downloads).toEqual(['drawing.step']);
  });

  it('opens PDFs and images in a tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(fakeTab());
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:img');

    service.openOrDownload('/api/v1/files/6/download', 'photo.png', 'image/png');
    http.expectOne('/api/v1/files/6/download').flush(new Blob(['x']));

    expect(open).toHaveBeenCalledWith('', '_blank');
  });

  it('decides from the file name when no content type is known', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(fakeTab());
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:po');

    service.openOrDownload('/api/v1/files/8/download', 'signed-po.PDF');
    http.expectOne('/api/v1/files/8/download').flush(new Blob(['x']));

    expect(open).toHaveBeenCalledWith('', '_blank');
  });
});
