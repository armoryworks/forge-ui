import { Directive, inject, input } from '@angular/core';

import { FileDownloadService } from '../services/file-download.service';

/**
 * A link to a file the API serves behind the login. The browser cannot follow the bare URL (it would carry no
 * token), so every way of opening the link goes through {@link FileDownloadService}: a plain click opens or
 * downloads the file as usual, while a middle click or a Ctrl/Cmd/Shift click opens it in a new tab.
 */
@Directive({
  selector: 'a[appFileLink]',
  standalone: true,
  host: {
    '[attr.href]': 'appFileLink()',
    '(click)': 'onClick($event)',
    '(auxclick)': 'onAuxClick($event)',
  },
})
export class FileLinkDirective {
  private readonly fileDownload = inject(FileDownloadService);

  readonly appFileLink = input.required<string>();
  readonly fileName = input.required<string>();
  readonly contentType = input<string | null | undefined>(null);

  protected onClick(event: MouseEvent): void {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      this.fileDownload.open(this.appFileLink(), this.fileName());
      return;
    }
    this.fileDownload.openOrDownload(this.appFileLink(), this.fileName(), this.contentType());
  }

  protected onAuxClick(event: MouseEvent): void {
    if (event.button !== 1) return;
    event.preventDefault();
    this.fileDownload.open(this.appFileLink(), this.fileName());
  }
}
