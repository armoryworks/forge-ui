import { Injectable } from '@angular/core';

import { printPdfBlob } from '../utils/print-pdf-blob';

/** Opens the print dialog for a fetched PDF in place (see {@link printPdfBlob}); injectable so screens can be tested without a frame. */
@Injectable({ providedIn: 'root' })
export class PrintPdfService {
  print(blob: Blob, fileName: string): void {
    printPdfBlob(blob, fileName);
  }
}
