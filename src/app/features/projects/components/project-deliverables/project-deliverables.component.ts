import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DeliverableService } from '../../services/deliverable.service';
import { Deliverable } from '../../models/deliverable.model';
import { DELIVERABLE_NEXT_STEPS, DELIVERABLE_STATUS_CHIP, DELIVERABLE_STATUS_KEYS, DeliverableStatus } from '../../models/deliverable-status.model';
import { DELIVERABLE_DELETE_ROLES, DELIVERABLE_TYPE_GROUP } from '../../models/project-roles.model';
import { DeliverableDialogComponent, DeliverableDialogData } from '../deliverable-dialog/deliverable-dialog.component';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

@Component({
  selector: 'app-project-deliverables',
  standalone: true,
  imports: [DateOnlyPipe, TranslatePipe, EntityLinkComponent],
  templateUrl: './project-deliverables.component.html',
  styleUrl: './project-deliverables.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDeliverablesComponent {
  private readonly deliverableService = inject(DeliverableService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input.required<number>();
  readonly customerId = input<number | null>(null);

  protected readonly canDelete = this.auth.hasAnyRole(DELIVERABLE_DELETE_ROLES);
  protected readonly deliverables = signal<Deliverable[]>([]);
  protected readonly typeLabels = signal<Map<number, string>>(new Map());
  protected readonly busy = signal(false);
  protected readonly nextSteps = DELIVERABLE_NEXT_STEPS;

  protected readonly overdueCount = computed(() => {
    const now = Date.now();
    return this.deliverables().filter(d => d.status !== 'Delivered' && d.dueDate && new Date(d.dueDate).getTime() < now).length;
  });

  constructor() {
    this.referenceData.getByGroup(DELIVERABLE_TYPE_GROUP).pipe(takeUntilDestroyed()).subscribe({
      next: items => this.typeLabels.set(new Map(items.map(i => [i.id, i.label]))),
    });
    effect(() => this.load(this.projectId()));
  }

  private load(projectId: number): void {
    this.deliverableService.listForProject(projectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: page => this.deliverables.set(page.items),
    });
  }

  protected statusKey(status: DeliverableStatus): string {
    return DELIVERABLE_STATUS_KEYS[status] ?? status;
  }

  protected statusChip(status: DeliverableStatus): string {
    return `chip ${DELIVERABLE_STATUS_CHIP[status] ?? 'chip--muted'}`;
  }

  protected openCreate(): void {
    this.openDialog(null);
  }

  protected edit(deliverable: Deliverable): void {
    this.openDialog(deliverable);
  }

  private openDialog(deliverable: Deliverable | null): void {
    this.dialog.open<DeliverableDialogComponent, DeliverableDialogData, Deliverable | undefined>(DeliverableDialogComponent, {
      width: '520px', data: { projectId: this.projectId(), customerId: this.customerId(), deliverable },
    }).afterClosed().subscribe(saved => {
      if (saved) this.load(this.projectId());
    });
  }

  protected advance(deliverable: Deliverable, status: DeliverableStatus): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.deliverableService.update(deliverable.id, {
      name: deliverable.name,
      description: deliverable.description,
      jobId: deliverable.jobId,
      projectId: deliverable.projectId,
      customerId: deliverable.customerId,
      deliverableTypeId: deliverable.deliverableTypeId,
      status,
      dueDate: deliverable.dueDate,
      fileAttachmentIds: deliverable.fileAttachmentIds,
      cloudLinkExternalId: deliverable.cloudLinkExternalId,
    }).subscribe({
      next: saved => {
        this.busy.set(false);
        this.deliverables.update(list => list.map(d => d.id === saved.id ? saved : d));
        this.snackbar.success(this.translate.instant('deliverables.statusChanged', { status: this.translate.instant(this.statusKey(status)) }));
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.snackbar.errorFrom(err, 'deliverables.saveFailed');
      },
    });
  }

  protected remove(deliverable: Deliverable): void {
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('deliverables.deleteTitle'),
        message: this.translate.instant('deliverables.deleteMessage', { name: deliverable.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      },
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deliverableService.delete(deliverable.id).subscribe({
        next: () => {
          this.deliverables.update(list => list.filter(d => d.id !== deliverable.id));
          this.snackbar.success(this.translate.instant('deliverables.deleted'));
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'deliverables.saveFailed'),
      });
    });
  }
}
