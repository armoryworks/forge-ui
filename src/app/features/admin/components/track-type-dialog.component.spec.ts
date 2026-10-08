import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { TrackTypeDialogComponent } from './track-type-dialog.component';
import { TrackTypeStagesService } from '../services/track-type-stages.service';
import { StageRequest } from '../models/stage-request.model';
import { TrackTypeStageAdmin } from '../models/track-type-stage-admin.model';
import { TrackType } from '../../../shared/models/track-type.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  stages: () => StageRequest[];
  startStage: () => StageRequest | null;
  hasVisibleStage: () => boolean;
  hideError: () => string | null;
  accountingWarnings: () => string[];
  isSaved(stage: StageRequest): boolean;
  hideStage(index: number): void;
  showStage(index: number): void;
  removeStage(index: number): void;
  moveStageUp(index: number): void;
  updateStage(index: number, field: keyof StageRequest, value: unknown): void;
  addStage(): void;
  onSubmit(): void;
}

function adminStage(overrides: Partial<TrackTypeStageAdmin>): TrackTypeStageAdmin {
  return {
    id: 1, name: 'Stage', code: 'stage', sortOrder: 1, color: '#94a3b8', wipLimit: null,
    isIrreversible: false, isMandatory: false, accountingDocumentType: null, isActive: true, openJobCount: 0,
    ...overrides,
  };
}

const production = {
  id: 1, name: 'Production', code: 'PRODUCTION', description: null, isDefault: true, sortOrder: 1, stages: [],
} as unknown as TrackType;

describe('TrackTypeDialogComponent', () => {
  let fixture: ComponentFixture<TrackTypeDialogComponent>;
  let component: DialogInternals;
  let allStages: TrackTypeStageAdmin[];
  let getStages: ReturnType<typeof vi.fn>;

  async function render(trackType: TrackType | null): Promise<void> {
    fixture = TestBed.createComponent(TrackTypeDialogComponent);
    fixture.componentRef.setInput('trackType', trackType);
    fixture.detectChanges();
    await Promise.resolve();
    component = fixture.componentInstance as unknown as DialogInternals;
  }

  beforeEach(() => {
    allStages = [
      adminStage({ id: 3, name: 'Order Confirmed', code: 'order_confirmed', sortOrder: 3, accountingDocumentType: 'SalesOrder' }),
      adminStage({ id: 1, name: 'Quote Requested', code: 'quote_requested', sortOrder: 1, openJobCount: 3 }),
      adminStage({ id: 2, name: 'Quoted', code: 'quoted', sortOrder: 2, isActive: false }),
      adminStage({ id: 4, name: 'Shipped', code: 'shipped', sortOrder: 4, isMandatory: true }),
    ];

    getStages = vi.fn(() => of(allStages));
    TestBed.configureTestingModule({
      imports: [TrackTypeDialogComponent],
      providers: [
        { provide: TrackTypeStagesService, useValue: { getStages } },
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
    TestBed.overrideComponent(TrackTypeDialogComponent, { set: { template: '' } });
  });

  it('loads every status, hidden ones included, in sort order', async () => {
    await render(production);

    expect(component.stages().map(s => [s.code, s.isActive])).toEqual([
      ['quote_requested', true],
      ['quoted', false],
      ['order_confirmed', true],
      ['shipped', true],
    ]);
    expect(component.startStage()?.name).toBe('Quote Requested');
  });

  it('refuses to hide a status that still holds work orders', async () => {
    await render(production);

    component.hideStage(0);

    expect(component.stages()[0].isActive).toBe(true);
    expect(component.hideError()).toBe('trackStages.hideBlockedOpenJobs');
  });

  it('refuses to hide a mandatory status', async () => {
    await render(production);

    component.hideStage(3);

    expect(component.stages()[3].isActive).toBe(true);
    expect(component.hideError()).toBe('trackStages.hideBlockedMandatory');
  });

  it('hides and shows a saved status and warns about its accounting document', async () => {
    await render(production);

    component.hideStage(2);
    expect(component.stages()[2].isActive).toBe(false);
    expect(component.accountingWarnings()).toEqual(['Order Confirmed']);

    component.showStage(1);
    expect(component.stages()[1].isActive).toBe(true);

    component.showStage(2);
    expect(component.accountingWarnings()).toEqual([]);
  });

  it('treats only stages the server knows about as saved', async () => {
    await render(production);

    component.addStage();
    const added = component.stages()[component.stages().length - 1];

    expect(component.isSaved(component.stages()[0])).toBe(true);
    expect(component.isSaved(added)).toBe(false);
    expect(added.isActive).toBe(true);
  });

  it('keeps edits made before the stage list loads and adds the hidden statuses', async () => {
    const response = new Subject<TrackTypeStageAdmin[]>();
    getStages.mockReturnValue(response);
    const withActive = {
      ...production,
      stages: allStages.filter(s => s.isActive),
    } as unknown as TrackType;
    await render(withActive);

    const confirmedIndex = component.stages().findIndex(s => s.code === 'order_confirmed');
    component.updateStage(confirmedIndex, 'name', 'Confirmed');
    response.next(allStages);

    expect(component.stages().map(s => [s.code, s.name, s.isActive])).toEqual([
      ['quote_requested', 'Quote Requested', true],
      ['quoted', 'Quoted', false],
      ['order_confirmed', 'Confirmed', true],
      ['shipped', 'Shipped', true],
    ]);
  });

  it('gives every status a distinct position when the list is reordered before it loads', async () => {
    const response = new Subject<TrackTypeStageAdmin[]>();
    getStages.mockReturnValue(response);
    const withActive = {
      ...production,
      stages: allStages.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    } as unknown as TrackType;
    await render(withActive);

    component.moveStageUp(component.stages().findIndex(s => s.code === 'order_confirmed'));
    response.next(allStages);

    expect(component.stages().map(s => [s.code, s.sortOrder])).toEqual([
      ['order_confirmed', 1],
      ['quote_requested', 2],
      ['quoted', 3],
      ['shipped', 4],
    ]);
  });

  it('still treats the order type\'s statuses as saved when the stage list fails to load', async () => {
    getStages.mockReturnValue(throwError(() => new Error('offline')));
    const withActive = {
      ...production,
      stages: [{ id: 4, name: 'Shipped', code: 'shipped', sortOrder: 1, color: '#c2410c', wipLimit: null,
        accountingDocumentType: 'Invoice', isIrreversible: false, isMandatory: true }],
    } as unknown as TrackType;
    await render(withActive);

    expect(component.isSaved(component.stages()[0])).toBe(true);
    component.hideStage(0);
    expect(component.hideError()).toBe('trackStages.hideBlockedMandatory');
  });

  it('reports when no status would stay visible', async () => {
    allStages = [adminStage({ id: 1, name: 'Only', code: 'only', sortOrder: 1 })];
    await render(production);

    component.hideStage(0);

    expect(component.hasVisibleStage()).toBe(false);
    expect(component.startStage()).toBeNull();
  });
});
