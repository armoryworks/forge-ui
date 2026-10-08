import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';

import { JobDetailPanelComponent } from './job-detail-panel.component';
import { KanbanService } from '../services/kanban.service';
import { LotService } from '../../lots/services/lot.service';
import { TimeTrackingService } from '../../time-tracking/services/time-tracking.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TimeEntry } from '../../time-tracking/models/time-entry.model';
import { Stage } from '../../../shared/models/stage.model';
import { JobDetail } from '../models/job-detail.model';
import { JobPart } from '../models/job-part.model';
import { PartSearchResult } from '../models/part-search-result.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PanelInternals {
  jobId: () => number;
  jobParts: { (): JobPart[]; set(v: JobPart[]): void };
  selectedPart: { (): PartSearchResult | null; set(v: PartSearchResult | null): void };
  partSearchControl: FormControl<string | null>;
  partQtyControl: FormControl<number | null>;
  selectPart(part: PartSearchResult): void;
  addPart(): void;
  canAddPart(): boolean;
  partQtyEditControl(jp: JobPart): FormControl<number | null>;
  savePartQty(jp: JobPart): void;
  canDispose(disposition: string | null): boolean;
  formatDisposition(disposition: string): string;
  timeEntries: { set(v: TimeEntry[]): void };
  hasActiveTimer: () => boolean;
  stopTimerForJob(): void;
  job: { set(v: JobDetail | null): void };
  availableStages: { set(v: Stage[]): void };
  onAllOperationsComplete(): void;
}

const JOB_ID = 42;

function part(overrides: Partial<PartSearchResult> = {}): PartSearchResult {
  return {
    id: 9,
    partNumber: '40-1700M',
    name: 'Mounting bracket',
    description: null,
    revision: 'A',
    status: 'Active',
    procurementSource: 'Make',
    inventoryClass: 'FinishedGood',
    bomLineCount: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function jobPart(overrides: Partial<JobPart> = {}): JobPart {
  return {
    id: 5,
    jobId: JOB_ID,
    partId: 9,
    partNumber: '40-1700M',
    partDescription: 'Mounting bracket',
    partStatus: 'Active',
    quantity: 25,
    notes: 'first article',
    ...overrides,
  };
}

function setup() {
  const kanban = {
    addJobPart: vi.fn(),
    updateJobPart: vi.fn(),
    getJobTimeEntries: vi.fn().mockReturnValue(of([])),
    moveJobStage: vi.fn().mockReturnValue(of(undefined)),
  };
  const snackbar = { success: vi.fn(), error: vi.fn() };
  const timeTracking = { stopTimer: vi.fn().mockReturnValue(of({})), startTimer: vi.fn() };
  const afterClosed = new Subject<unknown>();
  const dialog = { open: vi.fn().mockReturnValue({ afterClosed: () => afterClosed }) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: KanbanService, useValue: kanban },
      { provide: LotService, useValue: {} },
      { provide: TimeTrackingService, useValue: timeTracking },
      { provide: SnackbarService, useValue: snackbar },
      { provide: MatDialog, useValue: dialog },
      { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new JobDetailPanelComponent()) as unknown as PanelInternals;
  Object.defineProperty(component, 'jobId', { value: () => JOB_ID });
  return { component, kanban, snackbar, timeTracking, dialog, afterClosed };
}

describe('JobDetailPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('labels a selected part with its name when it has no description', () => {
    const { component } = setup();
    component.selectPart(part());
    expect(component.partSearchControl.value).toBe('40-1700M — Mounting bracket');
    expect(component.partSearchControl.value).not.toContain('null');
  });

  it('adds a part with the entered quantity and resets the quantity to 1', () => {
    const { component, kanban } = setup();
    kanban.addJobPart.mockReturnValue(of(jobPart({ quantity: 25 })));
    component.selectPart(part());
    component.partQtyControl.setValue(25);

    component.addPart();

    expect(kanban.addJobPart).toHaveBeenCalledWith(JOB_ID, 9, 25);
    expect(component.jobParts().map(p => p.quantity)).toEqual([25]);
    expect(component.partQtyControl.value).toBe(1);
    expect(component.selectedPart()).toBeNull();
  });

  it('refuses to add a part when the quantity is not above zero', () => {
    const { component, kanban } = setup();
    component.selectPart(part());
    component.partQtyControl.setValue(0);

    expect(component.canAddPart()).toBe(false);
    component.addPart();
    expect(kanban.addJobPart).not.toHaveBeenCalled();
  });

  it('saves an edited part quantity through updateJobPart, keeping the notes', () => {
    const { component, kanban } = setup();
    const jp = jobPart();
    component.jobParts.set([jp]);
    kanban.updateJobPart.mockReturnValue(of({ ...jp, quantity: 30 }));

    component.partQtyEditControl(jp).setValue(30);
    component.savePartQty(jp);

    expect(kanban.updateJobPart).toHaveBeenCalledWith(JOB_ID, 5, 30, 'first article');
    expect(component.jobParts()[0].quantity).toBe(30);
  });

  it('does not call the API when the quantity is unchanged', () => {
    const { component, kanban } = setup();
    const jp = jobPart();
    component.savePartQty(jp);
    expect(kanban.updateJobPart).not.toHaveBeenCalled();
  });

  it('restores the saved quantity when the edit is invalid or the save fails', () => {
    const { component, kanban } = setup();
    const jp = jobPart();
    const control = component.partQtyEditControl(jp);

    control.setValue(-3);
    component.savePartQty(jp);
    expect(kanban.updateJobPart).not.toHaveBeenCalled();
    expect(control.value).toBe(25);

    kanban.updateJobPart.mockReturnValue(throwError(() => new Error('boom')));
    control.setValue(40);
    component.savePartQty(jp);
    expect(control.value).toBe(25);
  });

  it('offers Dispose on undisposed and held work orders only', () => {
    const { component } = setup();
    expect(component.canDispose(null)).toBe(true);
    expect(component.canDispose('HoldForReview')).toBe(true);
    expect(component.canDispose('Scrap')).toBe(false);
    expect(component.canDispose('ShipToCustomer')).toBe(false);
  });

  it('translates the EnteredInError and Other dispositions', () => {
    const { component } = setup();
    expect(component.formatDisposition('EnteredInError')).toBe('kanban.dispositionEnteredInError');
    expect(component.formatDisposition('Other')).toBe('kanban.dispositionOther');
  });

  it('shows Stop only for the current user\'s own job-level timer and stops it by id', () => {
    const { component, timeTracking } = setup();
    component.timeEntries.set([
      timeEntry({ id: 11, userId: 2 }),
      timeEntry({ id: 12, userId: 1, jobOperationId: 4 }),
    ]);
    expect(component.hasActiveTimer()).toBe(false);

    component.timeEntries.set([
      timeEntry({ id: 11, userId: 2 }),
      timeEntry({ id: 13, userId: 1 }),
    ]);
    expect(component.hasActiveTimer()).toBe(true);

    component.stopTimerForJob();
    expect(timeTracking.stopTimer).toHaveBeenCalledWith({ timeEntryId: 13 });
  });

  it('offers to move the job to the next stage once every operation is done', () => {
    const { component, kanban, dialog, afterClosed } = setup();
    component.job.set({ id: JOB_ID, currentStageId: 2, stageName: 'Machining', stageColor: '#000' } as unknown as JobDetail);
    component.availableStages.set([
      { id: 1, name: 'Queued', color: '#111', sortOrder: 1 },
      { id: 2, name: 'Machining', color: '#222', sortOrder: 2 },
      { id: 3, name: 'Inspection', color: '#333', sortOrder: 3 },
    ] as unknown as Stage[]);

    component.onAllOperationsComplete();
    expect(dialog.open).toHaveBeenCalledOnce();
    afterClosed.next(true);

    expect(kanban.moveJobStage).toHaveBeenCalledWith(JOB_ID, 3);
  });

  it('does not prompt when the job is already in its last stage', () => {
    const { component, dialog } = setup();
    component.job.set({ id: JOB_ID, currentStageId: 3 } as unknown as JobDetail);
    component.availableStages.set([{ id: 3, name: 'Inspection', color: '#333', sortOrder: 3 }] as unknown as Stage[]);

    component.onAllOperationsComplete();
    expect(dialog.open).not.toHaveBeenCalled();
  });
});

function timeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 1,
    jobId: JOB_ID,
    jobNumber: 'JOB-0042',
    userId: 1,
    userName: 'Rivera, Sam',
    date: new Date('2026-10-08T00:00:00Z'),
    durationMinutes: 0,
    category: 'Production',
    notes: null,
    timerStart: new Date('2026-10-08T08:00:00Z'),
    timerStop: null,
    isManual: false,
    isLocked: false,
    createdAt: new Date('2026-10-08T08:00:00Z'),
    jobOperationId: null,
    ...overrides,
  };
}
