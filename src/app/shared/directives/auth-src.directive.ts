import { HttpClient, HttpContext } from '@angular/common/http';
import { DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';

import { environment } from '../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../interceptors/silent-http-errors.token';

const API_PATH = '/api/v1';

function resolveApiUrl(url: string): string {
  return url.startsWith(`${API_PATH}/`) ? `${environment.apiUrl}${url.slice(API_PATH.length)}` : url;
}

@Directive({
  selector: 'img[appAuthSrc], video[appAuthSrc]',
  standalone: true,
})
export class AuthSrcDirective {
  readonly appAuthSrc = input<string | null | undefined>(null);

  private readonly http = inject(HttpClient);
  private readonly el = inject<ElementRef<HTMLImageElement | HTMLVideoElement>>(ElementRef);
  private objectUrl: string | null = null;

  constructor() {
    effect(onCleanup => {
      const url = this.appAuthSrc();
      this.release();
      if (!url) return;
      const sub = this.http.get(resolveApiUrl(url), {
        responseType: 'blob',
        context: new HttpContext().set(SILENT_HTTP_ERRORS, true),
      }).subscribe({
        next: blob => {
          this.release();
          this.objectUrl = URL.createObjectURL(blob);
          this.el.nativeElement.src = this.objectUrl;
        },
        error: () => this.release(),
      });
      onCleanup(() => sub.unsubscribe());
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private release(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.el.nativeElement.removeAttribute('src');
  }
}
