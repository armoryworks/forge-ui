import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { EntityLinkComponent, LinkableEntityType } from '../../../shared/components/entity-link/entity-link.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FollowUpTask } from '../../../shared/models/follow-up-task.model';
import { FollowUpTaskService } from '../../../shared/services/follow-up-task.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';

const MAX_VISIBLE = 8;
const OLDER_THAN_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  ReorderSuggested: 'inventory',
};

const SOURCE_ENTITY_LINK_TYPES: Record<string, LinkableEntityType> = {
  Job: 'job',
  PurchaseOrder: 'purchase-order',
  SalesOrder: 'sales-order',
  Invoice: 'invoice',
  Shipment: 'shipment',
  Quote: 'quote',
  Part: 'part',
  Lot: 'lot',
  CustomerReturn: 'customer-return',
};

@Component({
  selector: 'app-action-items-widget',
  standalone: true,
  imports: [EntityLinkComponent, EmptyStateComponent, TranslatePipe, RouterLink, NgTemplateOutlet],
  templateUrl: './action-items-widget.component.html',
  styleUrl: './action-items-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionItemsWidgetComponent implements OnInit {
  private readonly taskService = inject(FollowUpTaskService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly tasks = signal<FollowUpTask[]>([]);
  protected readonly loading = signal(false);
  protected readonly olderExpanded = signal(false);

  protected readonly sortedTasks = computed(() => {
    const all = this.tasks();
    return [...all].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  });

  protected readonly currentTasks = computed(() =>
    this.sortedTasks().filter(t => !this.isOlder(t.dueDate)),
  );

  protected readonly olderTasks = computed(() =>
    this.sortedTasks().filter(t => this.isOlder(t.dueDate)),
  );

  protected readonly visibleTasks = computed(() =>
    this.currentTasks().slice(0, MAX_VISIBLE),
  );

  protected readonly hasMore = computed(() =>
    this.currentTasks().length > MAX_VISIBLE,
  );

  protected readonly totalCount = computed(() =>
    this.currentTasks().length,
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

  protected toggleOlder(): void {
    this.olderExpanded.update(expanded => !expanded);
  }

  protected getEntityType(sourceEntityType: string | null): LinkableEntityType | null {
    return sourceEntityType ? SOURCE_ENTITY_LINK_TYPES[sourceEntityType] ?? null : null;
  }

  protected getSourceLabel(task: FollowUpTask): string {
    return task.sourceEntityLabel ?? `#${task.sourceEntityId}`;
  }

  protected isReorderSuggestion(task: FollowUpTask): boolean {
    return task.triggerType === 'ReorderSuggested';
  }

  protected completeTask(task: FollowUpTask, event: Event): void {
    event.stopPropagation();
    this.taskService.completeTask(task.id).subscribe(() => {
      this.tasks.update(list => list.filter(t => t.id !== task.id));
      this.snackbar.success(this.translate.instant('replenishmentUi.taskCompleted'));
    });
  }

  protected dismissTask(task: FollowUpTask, event: Event): void {
    event.stopPropagation();
    this.taskService.dismissTask(task.id).subscribe(() => {
      this.tasks.update(list => list.filter(t => t.id !== task.id));
      this.snackbar.success(this.translate.instant('replenishmentUi.taskDismissed'));
    });
  }

  private isOlder(dueDate: string | null): boolean {
    if (!dueDate) return false;
    return new Date(dueDate).getTime() < Date.now() - OLDER_THAN_DAYS * DAY_MS;
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
