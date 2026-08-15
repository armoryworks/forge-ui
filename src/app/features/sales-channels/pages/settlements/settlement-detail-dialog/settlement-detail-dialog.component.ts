import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { LoadingBlockDirective } from '../../../../../shared/directives/loading-block.directive';
import { EntityLinkComponent } from '../../../../../shared/components/entity-link/entity-link.component';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { ChannelSettlementService } from '../../../services/channel-settlement.service';
import { ChannelSettlement } from '../../../models/channel-settlement.model';
import { ChannelSettlementLine } from '../../../models/channel-settlement-line.model';

export interface SettlementDetailDialogData {
  settlementId: number;
}

/** True when the dialog changed something the list needs to reflect. */
export type SettlementDetailDialogResult = boolean | undefined;

/**
 * The line detail behind one payout, and the place a variance gets signed off.
 *
 * <p>Lines are shown signed as the platform reports them — proceeds positive,
 * fees and refunds negative — so the batch reconciles by reading down the column
 * rather than by trusting a category legend. Unmatched lines float to the top
 * because they are the ones that need a person.</p>
 */
@Component({
  selector: 'app-settlement-detail-dialog',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatTooltipModule,
    TranslatePipe,
    DialogComponent,
    TextareaComponent,
    LoadingBlockDirective,
    EntityLinkComponent,
  ],
  templateUrl: './settlement-detail-dialog.component.html',
  styleUrl: './settlement-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettlementDetailDialogComponent {
  private readonly dialogRef =
    inject(MatDialogRef<SettlementDetailDialogComponent, SettlementDetailDialogResult>);
  private readonly data = inject<SettlementDetailDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(ChannelSettlementService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly settlement = signal<ChannelSettlement | null>(null);
  protected readonly lines = signal<ChannelSettlementLine[]>([]);
  protected readonly loading = signal(true);
  protected readonly accepting = signal(false);
  protected readonly showAcceptForm = signal(false);
  private readonly changed = signal(false);

  protected readonly notesControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });

  protected readonly canAccept = computed(() => {
    const s = this.settlement();
    return !!s && s.status === 'Discrepancy';
  });

  protected readonly hasVariance = computed(() => (this.settlement()?.variance ?? 0) !== 0);

  /** Line rows with their sign and match state resolved up front, not per binding. */
  protected readonly lineRows = computed(() =>
    this.lines().map((line) => ({
      line,
      typeLabelKey: `settlements.lineType.${line.lineType}`,
      isNegative: line.amount < 0,
    })),
  );

  protected readonly title = this.translate.instant('settlements.detailTitle');

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service.getSettlement(this.data.settlementId).subscribe({
      next: (detail) => {
        this.settlement.set(detail.settlement);
        this.lines.set(detail.lines);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected beginAccept(): void {
    this.showAcceptForm.set(true);
  }

  protected cancelAccept(): void {
    this.showAcceptForm.set(false);
    this.notesControl.reset('');
  }

  protected accept(): void {
    if (this.notesControl.invalid || this.accepting()) return;
    this.accepting.set(true);

    this.service.acceptVariance(this.data.settlementId, this.notesControl.value.trim()).subscribe({
      next: (updated) => {
        this.settlement.set(updated);
        this.accepting.set(false);
        this.showAcceptForm.set(false);
        this.changed.set(true);
        this.snackbar.success(this.translate.instant('settlements.accepted'));
      },
      error: () => this.accepting.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close(this.changed() ? true : undefined);
  }
}
