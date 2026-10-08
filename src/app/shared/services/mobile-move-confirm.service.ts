import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';

import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';
import { JobStatus } from '../models/mobile-api.model';
import { wasHttpErrorShown } from '../utils/shown-http-errors';

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

  /**
   * What to tell the person when a move or another floor action failed. A
   * refusal that the global error handling did not already show, such as a
   * quality gate on a silent first send, is named by the server's detail.
   */
  failureMessage(err: unknown): string {
    if (this.isConfirmRequired(err)) return this.translate.instant('mobileAppWork.confirmMove.changed');
    if (err instanceof HttpErrorResponse && !wasHttpErrorShown(err)) {
      const detail: unknown = err.error?.detail;
      if (typeof detail === 'string' && detail.trim()) return detail;
      if (err.status === 0) return this.translate.instant('errors.unableToReachServer');
      if (err.status === 403 && !capabilityDisabled(err)) return this.translate.instant('errors.accessDenied');
    }
    return this.translate.instant('mobileApp.jobs.actionFailed');
  }
}

function capabilityDisabled(err: HttpErrorResponse): boolean {
  return err.error?.errors?.[0]?.code === 'capability-disabled' || !!err.headers?.get('X-Capability-Disabled');
}
