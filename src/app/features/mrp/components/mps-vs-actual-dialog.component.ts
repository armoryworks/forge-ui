import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { MrpService } from '../services/mrp.service';
import { MasterSchedule, MpsVsActual } from '../models/mrp.model';

export interface MpsVsActualDialogData {
  schedule: MasterSchedule;
}

/**
 * Master-schedule-vs-actuals reconciliation. For each part on the
 * schedule, sums planned quantity (from the schedule's lines) and
 * actual completed-quantity (from production runs in the schedule
 * window) and surfaces the variance + variance percent. Negative
 * variance = under-delivered, positive = over-delivered.
 */
@Component({
  selector: 'app-mps-vs-actual-dialog',
  standalone: true,
  imports: [
    DecimalPipe, TranslatePipe,
    DialogComponent, LoadingBlockDirective, EmptyStateComponent,
  ],
  templateUrl: './mps-vs-actual-dialog.component.html',
  styleUrl: './mps-vs-actual-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MpsVsActualDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<MpsVsActualDialogComponent>);
  private readonly data = inject<MpsVsActualDialogData>(MAT_DIALOG_DATA);
  private readonly mrpService = inject(MrpService);

  protected readonly schedule = this.data.schedule;
  protected readonly loading = signal(true);
  protected readonly rows = signal<MpsVsActual[]>([]);

  protected readonly totals = computed(() => {
    const r = this.rows();
    const planned = r.reduce((s, x) => s + x.plannedQuantity, 0);
    const actual = r.reduce((s, x) => s + x.actualQuantity, 0);
    const variance = actual - planned;
    const variancePct = planned !== 0 ? Math.round((variance / planned) * 10000) / 100 : 0;
    return { planned, actual, variance, variancePct };
  });

  constructor() {
    this.mrpService.getMpsVsActual(this.schedule.id).subscribe({
      next: (data) => { this.rows.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected varianceClass(v: number): string {
    if (v > 0) return 'mps-actual__pos';
    if (v < 0) return 'mps-actual__neg';
    return '';
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
