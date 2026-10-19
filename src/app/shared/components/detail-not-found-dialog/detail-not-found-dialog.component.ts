import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

import { notFoundError } from '../../utils/not-found-error';
import { DetailLoadErrorComponent } from '../detail-load-error/detail-load-error.component';

/** Detail dialog for a `?detail=` link whose record id is malformed: the same not-found card a missing record shows. */
@Component({
  selector: 'app-detail-not-found-dialog',
  standalone: true,
  imports: [DetailLoadErrorComponent],
  templateUrl: './detail-not-found-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailNotFoundDialogComponent {
  private readonly ref = inject<MatDialogRef<DetailNotFoundDialogComponent>>(MatDialogRef);

  protected readonly error = notFoundError();

  close(): void {
    this.ref.close();
  }
}
