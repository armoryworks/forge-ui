import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { UninvoicedJob } from '../../models/uninvoiced-job.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';

@Component({
  selector: 'app-uninvoiced-jobs-panel',
  standalone: true,
  imports: [DatePipe, TranslatePipe, DialogComponent],
  templateUrl: './uninvoiced-jobs-panel.component.html',
  styleUrl: './uninvoiced-jobs-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UninvoicedJobsPanelComponent {
  readonly jobs = input.required<UninvoicedJob[]>();
  readonly closed = output<void>();
  readonly createInvoice = output<number>();

  protected close(): void {
    this.closed.emit();
  }

  protected onCreateInvoice(jobId: number): void {
    this.createInvoice.emit(jobId);
  }
}
