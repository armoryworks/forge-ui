import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { downloadBlob } from '../utils/download-blob';

const VIEWABLE_TYPE = /^(application\/pdf|image\/|text\/plain)/i;
const VIEWABLE_EXTENSION = /\.(pdf|png|jpe?g|gif|webp|svg|txt)$/i;
const OBJECT_URL_LIFETIME_MS = 60_000;

/**
 * Opens or downloads files served by the API. A bare `window.open(apiUrl)` tab carries no bearer
 * token and is answered 401, so the file is fetched through HttpClient (the auth interceptor adds
 * the token) and handed to the browser as a blob.
 */
@Injectable({ providedIn: 'root' })
export class FileDownloadService {
  private readonly http = inject(HttpClient);

  /**
   * Shows the file in a new tab. The tab is opened synchronously, inside the click, so popup
   * blockers allow it, and pointed at the file once it arrives. When the tab could not be opened
   * the file is downloaded as `fileName` instead; when the fetch fails the empty tab is closed.
   */
  open(url: string, fileName: string): void {
    const tab = window.open('', '_blank');
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        if (!tab || tab.closed) {
          downloadBlob(blob, fileName);
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        tab.location.href = objectUrl;
        setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_LIFETIME_MS);
      },
      error: () => tab?.close(),
    });
  }

  /** Saves the file as `fileName`. */
  download(url: string, fileName: string): void {
    this.http.get(url, { responseType: 'blob' }).subscribe(blob => downloadBlob(blob, fileName));
  }

  /**
   * Opens files a browser can show (PDF, images, plain text) in a new tab and downloads the rest.
   * Without a content type the decision is made from the file name's extension.
   */
  openOrDownload(url: string, fileName: string, contentType?: string | null): void {
    const viewable = contentType ? VIEWABLE_TYPE.test(contentType) : VIEWABLE_EXTENSION.test(fileName);
    if (viewable) this.open(url, fileName);
    else this.download(url, fileName);
  }
}
