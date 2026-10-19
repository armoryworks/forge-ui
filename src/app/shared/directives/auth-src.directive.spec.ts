import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthSrcDirective } from './auth-src.directive';
import { SILENT_HTTP_ERRORS } from '../interceptors/silent-http-errors.token';

@Component({
  standalone: true,
  imports: [AuthSrcDirective],
  template: `<img [appAuthSrc]="url()" alt="cover" />`,
})
class HostComponent {
  readonly url = signal<string | null>('/api/v1/files/14/download');
}

describe('AuthSrcDirective', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('fetches the image through HttpClient and shows it from an object URL', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cover');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const req = http.expectOne('/api/v1/files/14/download');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    req.flush(new Blob(['x'], { type: 'image/png' }));

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(create).toHaveBeenCalled();
    expect(img.getAttribute('src')).toBe('blob:cover');

    fixture.destroy();
    expect(revoke).toHaveBeenCalledWith('blob:cover');
  });

  it('shows nothing when the fetch fails', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    http.expectOne('/api/v1/files/14/download').flush(new Blob(['no']), { status: 404, statusText: 'Not Found' });

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.hasAttribute('src')).toBe(false);
  });
});
