import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { EntityLinkComponent, LinkableEntityType } from '../../../shared/components/entity-link/entity-link.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FollowUpTask } from '../../../shared/models/follow-up-task.model';
import { FollowUpTaskService } from '../../../shared/services/follow-up-task.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';

const MAX_VISIBLE = 8;

const TRIGGER_ICON_MAP: Record<string, string> = {
  QuoteExpiring: 'event_busy',
  LeadStale: 'person_off',
  InvoicePastDue: 'payments',
  DeliveryAtRisk: 'local_shipping',
  CostOverrun: 'attach_money',
  CertExpiring: 'badge',
  MaintenanceDue: 'build',
  QcFailure: 'error',
  ReturnReceived: 'assignment_return',
  SalesOrderConfirmed: 'shopping_cart',
  ShipReady: 'local_shipping',
  MaterialsReady: 'shopping_cart',
  ShipmentDelivered: 'local_shipping',
};

@Component({
  selector: 'app-action-items-widget',
  standalone: true,
  imports: [EntityLinkComponent, EmptyStateComponent, TranslatePipe],
  templateUrl: './action-items-widget.component.html',
  styleUrl: './action-items-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionItemsWidgetComponent implements OnInit {
  private readonly taskService = inject(FollowUpTaskService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly tasks = signal<FollowUpTask[]>([]);
  protected readonly loading = signal(false);

  protected readonly sortedTasks = computed(() => {
    const all = this.tasks();
    return [...all].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  });

  protected readonly visibleTasks = computed(() =>
    this.sortedTasks().slice(0, MAX_VISIBLE),
  );

  protected readonly hasMore = computed(() =>
    this.sortedTasks().length > MAX_VISIBLE,
  );

  protected readonly totalCount = computed(() =>
    this.sortedTasks().length,
  );

  ngOnInit(): void {
    this.loadTasks();
  }

  protected getIcon(triggerType: string): string {
    return TRIGGER_ICON_MAP[triggerType] ?? 'task_alt';
  }

  protected formatDate(isoDate: string): string {
    const d = new Date(isoDate);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  protected isOverdue(dueDate: string | null): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  protected getEntityType(sourceEntityType: string | null): LinkableEntityType {
    return (sourceEntityType ?? 'job') as LinkableEntityType;
  }

  protected completeTask(task: FollowUpTask, event: Event): void {
    event.stopPropagation();
    this.taskService.completeTask(task.id).subscribe(() => {
      this.tasks.update(list => list.filter(t => t.id !== task.id));
      this.snackbar.success('Task completed');
    });
  }

  protected dismissTask(task: FollowUpTask, event: Event): void {
    event.stopPropagation();
    this.taskService.dismissTask(task.id).subscribe(() => {
      this.tasks.update(list => list.filter(t => t.id !== task.id));
      this.snackbar.success('Task dismissed');
    });
  }

  private loadTasks(): void {
    this.loading.set(true);
    this.taskService.getTasks('Open').subscribe({
      next: (data) => {
        this.tasks.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
