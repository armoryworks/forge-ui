import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../testing/signal-input-harness';
import { TranslateService } from '@ngx-translate/core';

import { ActivityItem } from '../../models/activity.model';
import { DisplayActivity } from '../../models/display-activity.model';
import { EntityNote } from '../../models/entity-note.model';
import { EntityActivityService } from '../../services/entity-activity.service';
import { ActivityFilterTab, EntityActivitySectionComponent } from './entity-activity-section.component';

interface SectionInternals {
  allActivityItems(): DisplayActivity[];
  allItemKey(item: ActivityItem): string;
  batchLabelKey(count: number): string;
  loadData(entityType: string, entityId: number): void;
}

const comment: ActivityItem = {
  id: 1, action: 'Comment', description: 'Ready to ship', createdAt: new Date('2026-10-01T10:00:00Z'),
};
const fieldChange: ActivityItem = {
  id: 2, action: 'FieldChanged', description: 'Assignee: (none) → Admin User',
  createdAt: new Date('2026-10-01T12:00:00Z'), userInitials: 'AU', userName: 'Admin User',
};
const note: EntityNote = {
  id: 2, text: 'Call the design partner', authorName: 'Admin User', authorInitials: 'AU',
  authorColor: '#0d9488', createdAt: new Date('2026-10-01T11:00:00Z'), updatedAt: null,
};

function setup(tabs: ActivityFilterTab[], history: ActivityItem[] = [fieldChange]) {
  const service = {
    getActivity: vi.fn(() => of([comment, fieldChange])),
    getNotes: vi.fn(() => of([note])),
    getHistory: vi.fn(() => of(history)),
    getMentionUsers: vi.fn(() => of([])),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: EntityActivityService, useValue: service },
      { provide: TranslateService, useValue: { instant: (key: string, params?: { count: number }) => `${key}:${params?.count}` } },
    ],
  });

  const component = TestBed.runInInjectionContext(() => new EntityActivitySectionComponent());
  mockSignalInputs(component, { entityType: 'Job', entityId: 42, tabs });
  const internals = component as unknown as SectionInternals;
  internals.loadData('Job', 42);
  return { internals, service };
}

describe('EntityActivitySectionComponent', () => {
  it('merges comments, notes and history into All, newest first', () => {
    const { internals, service } = setup(['all', 'comments', 'notes', 'history']);

    expect(service.getHistory).toHaveBeenCalledWith('Job', 42);
    expect(internals.allActivityItems().map(i => i.description)).toEqual([
      'Assignee: (none) → Admin User',
      'Call the design partner',
      'Ready to ship',
    ]);
  });

  it('loads history for All even when History is not a tab', () => {
    const { internals, service } = setup(['all', 'comments']);

    expect(service.getHistory).toHaveBeenCalledWith('Job', 42);
    expect(internals.allActivityItems().some(i => i.action === 'FieldChanged')).toBe(true);
  });

  it('skips history when neither All nor History is a tab', () => {
    const { service } = setup(['comments', 'notes']);

    expect(service.getHistory).not.toHaveBeenCalled();
  });

  it('keys a note apart from a log row with the same id', () => {
    const { internals } = setup(['all']);
    const keys = internals.allActivityItems().map(i => internals.allItemKey(i));

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('folds the field rows of one save under its summary entry in All', () => {
    const savedAt = new Date('2026-10-16T09:02:21Z');
    const history: ActivityItem[] = [
      { id: 20, action: 'credit-hold-released', description: 'Credit hold released', createdAt: savedAt, userInitials: 'CT' },
      { id: 21, action: 'FieldChanged', description: 'Is On Credit Hold: true → false', createdAt: savedAt, userInitials: 'CT' },
      { id: 22, action: 'FieldChanged', description: 'Credit Hold By: Casey Thompson → (none)', createdAt: savedAt, userInitials: 'CT' },
    ];
    const { internals } = setup(['all'], history);

    const summary = internals.allActivityItems().find(i => i.id === 20);
    expect(internals.allActivityItems().some(i => i.id === 21 || i.id === 22)).toBe(false);
    expect(summary?.batchedItems?.map(i => i.id)).toEqual([21, 22]);
  });

  it('labels a folded single field change in the singular', () => {
    const { internals } = setup(['all']);

    expect(internals.batchLabelKey(1)).toBe('activityHistory.fieldChange');
    expect(internals.batchLabelKey(3)).toBe('activityHistory.fieldChanges');
  });

  it('reloads when the host passes a new refresh key', () => {
    const service = {
      getActivity: vi.fn(() => of([])),
      getNotes: vi.fn(() => of([])),
      getHistory: vi.fn(() => of([])),
      getMentionUsers: vi.fn(() => of([])),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: EntityActivityService, useValue: service },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new EntityActivitySectionComponent());
    const inputs = mockSignalInputs(component, {
      entityType: 'PurchaseOrder', entityId: 7, tabs: ['all'] as ActivityFilterTab[], refreshKey: { status: 'Draft' } as unknown,
    });
    TestBed.tick();
    expect(service.getHistory).toHaveBeenCalledTimes(1);

    inputs.refreshKey.set({ status: 'Submitted' });
    TestBed.tick();

    expect(service.getHistory).toHaveBeenCalledTimes(2);
    expect(service.getActivity).toHaveBeenLastCalledWith('PurchaseOrder', 7);
  });
});
