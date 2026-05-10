import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { MrpService } from '../services/mrp.service';
import { MrpPartPlan, MrpPegging, MrpPlannedOrder, MrpRun } from '../models/mrp.model';

export interface MrpRunDetailDialogData {
  run: MrpRun;
}

interface PartRow {
  partId: number;
  partNumber: string;
  partDescription: string | null;
  orderCount: number;
  totalQuantity: number;
}

/**
 * Run-detail drill-in. Top half summarises the run; bottom half lists
 * the parts touched by the run. Selecting a part loads its time-bucket
 * plan (gross requirements / scheduled receipts / projected on-hand /
 * net requirements / planned-order releases) and its pegging trail
 * (which demand drove which supply).
 */
@Component({
  selector: 'app-mrp-run-detail-dialog',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TranslatePipe,
    DialogComponent, LoadingBlockDirective, EmptyStateComponent,
  ],
  templateUrl: './mrp-run-detail-dialog.component.html',
  styleUrl: './mrp-run-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MrpRunDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<MrpRunDetailDialogComponent>);
  private readonly data = inject<MrpRunDetailDialogData>(MAT_DIALOG_DATA);
  private readonly mrpService = inject(MrpService);
  protected readonly translate = inject(TranslateService);

  protected readonly run = this.data.run;
  protected readonly loadingParts = signal(true);
  protected readonly loadingDrill = signal(false);

  protected readonly orders = signal<MrpPlannedOrder[]>([]);
  protected readonly selectedPartId = signal<number | null>(null);
  protected readonly partPlan = signal<MrpPartPlan | null>(null);
  protected readonly pegging = signal<MrpPegging[]>([]);

  protected readonly parts = computed<PartRow[]>(() => {
    const byPart = new Map<number, PartRow>();
    for (const o of this.orders()) {
      const existing = byPart.get(o.partId);
      if (existing) {
        existing.orderCount += 1;
        existing.totalQuantity += o.quantity;
      } else {
        byPart.set(o.partId, {
          partId: o.partId,
          partNumber: o.partNumber,
          partDescription: o.partDescription,
          orderCount: 1,
          totalQuantity: o.quantity,
        });
      }
    }
    return Array.from(byPart.values()).sort((a, b) => a.partNumber.localeCompare(b.partNumber));
  });

  constructor() {
    this.mrpService.getPlannedOrders(this.run.id).subscribe({
      next: (data) => { this.orders.set(data); this.loadingParts.set(false); },
      error: () => this.loadingParts.set(false),
    });
  }

  protected selectPart(partId: number): void {
    this.selectedPartId.set(partId);
    this.partPlan.set(null);
    this.pegging.set([]);
    this.loadingDrill.set(true);

    let pendingResponses = 2;
    const finish = () => {
      pendingResponses -= 1;
      if (pendingResponses === 0) this.loadingDrill.set(false);
    };

    this.mrpService.getPartPlan(this.run.id, partId).subscribe({
      next: (plan) => { this.partPlan.set(plan); finish(); },
      error: finish,
    });
    this.mrpService.getPegging(this.run.id, partId).subscribe({
      next: (peg) => { this.pegging.set(peg); finish(); },
      error: finish,
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
