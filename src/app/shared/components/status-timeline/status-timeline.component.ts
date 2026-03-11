import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';

import { LoadingBlockDirective } from '../../directives/loading-block.directive';
import { SnackbarService } from '../../services/snackbar.service';
import { StatusTrackingService } from '../../services/status-tracking.service';
import { StatusEntry } from '../../models/status-entry.model';
import { ActiveStatus } from '../../models/active-status.model';
import { SelectOption } from '../select/select.component';
import { AdminService } from '../../../features/admin/services/admin.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { SetStatusDialogComponent, SetStatusDialogData } from '../set-status-dialog/set-status-dialog.component';
import { AddHoldDialogComponent, AddHoldDialogData } from '../add-hold-dialog/add-hold-dialog.component';

@Component({
  selector: 'app-status-timeline',
  standalone: true,
  imports: [DatePipe, LoadingBlockDirective],
  templateUrl: './status-timeline.component.html',
  styleUrl: './status-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusTimelineComponent {
  private readonly statusTrackingService = inject(StatusTrackingService);
  private readonly adminService = inject(AdminService);
  private readonly matDialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  readonly entityType = input.required<string>();
  readonly entityId = input.required<number>();

  protected readonly history = signal<StatusEntry[]>([]);
  protected readonly activeStatus = signal<ActiveStatus | null>(null);
  protected readonly loading = signal(false);
  protected readonly workflowOptions = signal<SelectOption[]>([]);
  protected readonly holdOptions = signal<SelectOption[]>([]);

  constructor() {
    effect(() => {
      const entityType = this.entityType();
      const entityId = this.entityId();
      if (entityId > 0) {
        this.loadData(entityType, entityId);
        this.loadStatusOptions(entityType);
      }
    });
  }

  private loadData(entityType: string, entityId: number): void {
    this.loading.set(true);
    forkJoin({
      history: this.statusTrackingService.getHistory(entityType, entityId),
      active: this.statusTrackingService.getActiveStatus(entityType, entityId),
    }).subscribe({
      next: ({ history, active }) => {
        this.history.set(history);
        this.activeStatus.set(active);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadStatusOptions(entityType: string): void {
    const workflowGroup = `${entityType.toLowerCase()}_workflow_status`;
    const holdGroup = `${entityType.toLowerCase()}_hold_type`;

    this.adminService.getReferenceData().subscribe(groups => {
      const workflowEntries = groups.find(g => g.groupCode === workflowGroup);
      if (workflowEntries) {
        this.workflowOptions.set(
          workflowEntries.values
            .filter(v => v.isActive)
            .map(v => ({ value: v.code, label: v.label })),
        );
      }

      const holdEntries = groups.find(g => g.groupCode === holdGroup);
      if (holdEntries) {
        this.holdOptions.set(
          holdEntries.values
            .filter(v => v.isActive)
            .map(v => ({ value: v.code, label: v.label })),
        );
      }
    });
  }

  protected openSetStatus(): void {
    this.matDialog.open(SetStatusDialogComponent, {
      width: '420px',
      data: {
        entityType: this.entityType(),
        entityId: this.entityId(),
        currentStatusCode: this.activeStatus()?.workflowStatus?.statusCode,
        statusOptions: this.workflowOptions(),
      } satisfies SetStatusDialogData,
    }).afterClosed().subscribe(result => {
      if (result) {
        this.loadData(this.entityType(), this.entityId());
        this.snackbar.success('Status updated.');
      }
    });
  }

  protected openAddHold(): void {
    this.matDialog.open(AddHoldDialogComponent, {
      width: '420px',
      data: {
        entityType: this.entityType(),
        entityId: this.entityId(),
        holdOptions: this.holdOptions(),
      } satisfies AddHoldDialogData,
    }).afterClosed().subscribe(result => {
      if (result) {
        this.loadData(this.entityType(), this.entityId());
        this.snackbar.success('Hold added.');
      }
    });
  }

  protected releaseHold(entry: StatusEntry): void {
    this.matDialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Release Hold?',
        message: `Release the "${entry.statusLabel}" hold?`,
        confirmLabel: 'Release',
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.statusTrackingService.releaseHold(entry.id).subscribe(() => {
        this.loadData(this.entityType(), this.entityId());
        this.snackbar.success('Hold released.');
      });
    });
  }
}
