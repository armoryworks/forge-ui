import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { FollowUpTask } from '../../../shared/models/follow-up-task.model';
import { FollowUpTaskService } from '../../../shared/services/follow-up-task.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ActionItemsWidgetComponent } from './action-items-widget.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface WidgetInternals {
  getIcon(triggerType: string): string;
  getEntityType(sourceEntityType: string | null): string | null;
  getSourceLabel(task: FollowUpTask): string;
  isReorderSuggestion(task: FollowUpTask): boolean;
  completeTask(task: FollowUpTask, event: Event): void;
  dismissTask(task: FollowUpTask, event: Event): void;
}

function task(overrides: Partial<FollowUpTask> = {}): FollowUpTask {
  return {
    id: 1, title: 'Follow up', description: null, assignedToUserId: 2, assignedToName: 'Avery',
    dueDate: null, sourceEntityType: 'Job', sourceEntityId: 58, sourceEntityLabel: 'J-58 Bracket run',
    triggerType: 'DeliveryAtRisk', status: 'Open', completedAt: null, dismissedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function setup() {
  const snackbar = { success: vi.fn(), error: vi.fn() };
  const taskService = {
    getTasks: vi.fn(() => of([])),
    completeTask: vi.fn(() => of(undefined)),
    dismissTask: vi.fn(() => of(undefined)),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: FollowUpTaskService, useValue: taskService },
      { provide: SnackbarService, useValue: snackbar },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ActionItemsWidgetComponent());
  return { internals: component as unknown as WidgetInternals, snackbar };
}

describe('ActionItemsWidgetComponent', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('maps PascalCase source types to linkable entity types', () => {
    const { internals } = setup();

    expect(internals.getEntityType('Job')).toBe('job');
    expect(internals.getEntityType('PurchaseOrder')).toBe('purchase-order');
    expect(internals.getEntityType('SalesOrder')).toBe('sales-order');
    expect(internals.getEntityType('Invoice')).toBe('invoice');
    expect(internals.getEntityType('Shipment')).toBe('shipment');
    expect(internals.getEntityType('Quote')).toBe('quote');
    expect(internals.getEntityType('Part')).toBe('part');
    expect(internals.getEntityType('Lot')).toBe('lot');
    expect(internals.getEntityType('CustomerReturn')).toBe('customer-return');
  });

  it('treats unknown or missing source types as plain text', () => {
    const { internals } = setup();

    expect(internals.getEntityType('Lead')).toBeNull();
    expect(internals.getEntityType('job')).toBeNull();
    expect(internals.getEntityType(null)).toBeNull();
  });

  it('shows the source label instead of the type and id', () => {
    const { internals } = setup();

    expect(internals.getSourceLabel(task())).toBe('J-58 Bracket run');
    expect(internals.getSourceLabel(task({ sourceEntityLabel: null }))).toBe('#58');
  });

  it('gives reorder suggestions an inventory icon and a review link', () => {
    const { internals } = setup();
    const reorder = task({ triggerType: 'ReorderSuggested', sourceEntityType: 'ReorderSuggestion', sourceEntityId: 7 });

    expect(internals.getIcon('ReorderSuggested')).toBe('inventory');
    expect(internals.isReorderSuggestion(reorder)).toBe(true);
    expect(internals.isReorderSuggestion(task())).toBe(false);
  });

  it('translates the complete and dismiss snackbars', () => {
    const { internals, snackbar } = setup();
    const event = new Event('click');

    internals.completeTask(task({ id: 1 }), event);
    internals.dismissTask(task({ id: 2 }), event);

    expect(snackbar.success).toHaveBeenNthCalledWith(1, 'replenishmentUi.taskCompleted');
    expect(snackbar.success).toHaveBeenNthCalledWith(2, 'replenishmentUi.taskDismissed');
  });
});
