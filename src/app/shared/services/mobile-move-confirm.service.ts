import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';

import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';
import { JobStatus } from '../models/mobile-api.model';

/**
 * The phone asks before moving a job into a column that can't be undone or
 * that creates an accounting document, naming the column and what it
 * creates. Such a move is sent with `confirmed` and offers no undo.
 */
@Injectable({ providedIn: 'root' })
export class MobileMoveConfirmService {
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  needed(job: JobStatus): boolean {
    return job.nextStageId !== null && (!!job.nextStageIsIrreversible || !!job.nextStageAccountingDocument);
  }

  async ask(job: JobStatus): Promise<boolean> {
    const status = job.nextStageName ?? '';
    const document = job.nextStageAccountingDocument
      ? this.translate.instant(`mobileAppWork.confirmMove.document.${job.nextStageAccountingDocument}`)
      : null;
    const messageKey = document
      ? (job.nextStageIsIrreversible ? 'mobileAppWork.confirmMove.createsIrreversible' : 'mobileAppWork.confirmMove.creates')
      : 'mobileAppWork.confirmMove.irreversible';
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('mobileAppWork.confirmMove.title', { job: job.jobNumber, status }),
        message: this.translate.instant(messageKey, { document }),
        confirmLabel: this.translate.instant('mobileAppWork.confirmMove.confirm', { status }),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  /** The server refused an unconfirmed move into such a column. */
  isConfirmRequired(err: unknown): boolean {
    return err instanceof HttpErrorResponse && err.status === 400 && err.error?.code === 'confirm-required';
  }
}
