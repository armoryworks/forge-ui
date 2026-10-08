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
import { JobPart } from '../models/job-part.model';
import { JobDetail } from '../models/job-detail.model';
import { JobLink } from '../models/job-link.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PanelInternals {
  jobId: () => number;
  job: { (): JobDetail | null; set(v: JobDetail | null): void };
  jobParts: { (): JobPart[]; set(v: JobPart[]): void };
  links: { (): JobLink[]; set(v: JobLink[]): void };
  selectedPartId: () => number | null;
  selectedLinkTargetId: () => number | null;
  partPickerControl: FormControl<number | null>;
  linkTargetControl: FormControl<number | null>;
  partQtyControl: FormControl<number | null>;
  showSubtaskAdd: () => boolean;
  showLinkAdd: () => boolean;
  showPartAdd: () => boolean;
  isAdmin: () => boolean;
  toggleSubtaskAdd(): void;
  toggleLinkAdd(): void;
  togglePartAdd(): void;
  onPartPicked(row: Record<string, unknown> | null): void;
  onLinkTargetPicked(row: Record<string, unknown> | null): void;
  addPart(): void;
  addLink(): void;
  archiveJob(): void;
  unarchiveJob(): void;
  canAddPart(): boolean;
  partQtyEditControl(jp: JobPart): FormControl<number | null>;
  savePartQty(jp: JobPart): void;
  canDispose(disposition: string | null): boolean;
  formatDisposition(disposition: string): string;
  timeEntries: { set(v: TimeEntry[]): void };
  hasActiveTimer: () => boolean;
  stopTimerForJob(): void;
  availableStages: { set(v: Stage[]): void };
  onAllOperationsComplete(): void;
}

const JOB_ID = 42;

const PART_ROW: Record<string, unknown> = { id: 9, partNumber: '40-1700M', name: 'Mounting bracket' };

function jobDetail(overrides: Partial<JobDetail> = {}): JobDetail {
  return { id: JOB_ID, jobNumber: 'WO-0042', isArchived: false, ...overrides } as JobDetail;
}

function jobLink(overrides: Partial<JobLink> = {}): JobLink {
  return { id: 3, linkedJobId: 77, linkType: 'RelatedTo', ...overrides } as JobLink;
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

function setup(options: { admin?: boolean; confirm?: boolean } = {}) {
  const kanban = {
    addJobPart: vi.fn(),
    updateJobPart: vi.fn(),
    createJobLink: vi.fn(),
    bulkArchive: vi.fn(),
    unarchiveJob: vi.fn(),
    getJobTimeEntries: vi.fn().mockReturnValue(of([])),
    moveJobStage: vi.fn().mockReturnValue(of(undefined)),
  };
  const snackbar = { success: vi.fn(), error: vi.fn() };
  const timeTracking = { stopTimer: vi.fn().mockReturnValue(of({})), startTimer: vi.fn() };
  const afterClosed = new Subject<unknown>();
  const dialog = {
    open: vi.fn(() => ({ afterClosed: () => (options.confirm === undefined ? afterClosed : of(options.confirm)) })),
  };
  const auth = {
    user: () => ({ id: 1 }),
    hasRole: vi.fn((role: string) => role === 'Admin' && !!options.admin),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: KanbanService, useValue: kanban },
      { provide: LotService, useValue: {} },
      { provide: TimeTrackingService, useValue: timeTracking },
      { provide: SnackbarService, useValue: snackbar },
      { provide: MatDialog, useValue: dialog },
      { provide: AuthService, useValue: auth },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new JobDetailPanelComponent()) as unknown as PanelInternals;
  Object.defineProperty(component, 'jobId', { value: () => JOB_ID });
  return { component, kanban, snackbar, timeTracking, dialog, afterClosed };
}

describe('JobDetailPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('keeps the subtask, link and part add forms hidden until [+] is pressed', () => {
    const { component } = setup();
    expect(component.showSubtaskAdd()).toBe(false);
    expect(component.showLinkAdd()).toBe(false);
    expect(component.showPartAdd()).toBe(false);

    component.toggleSubtaskAdd();
    component.toggleLinkAdd();
    component.togglePartAdd();
    expect(component.showSubtaskAdd()).toBe(true);
    expect(component.showLinkAdd()).toBe(true);
    expect(component.showPartAdd()).toBe(true);

    component.togglePartAdd();
    expect(component.showPartAdd()).toBe(false);
  });

  it('drops a hidden selection when an add form is closed with [x]', () => {
    const { component, kanban } = setup();
    component.togglePartAdd();
    component.partPickerControl.setValue(9);
    component.onPartPicked(PART_ROW);
    component.partQtyControl.setValue(5);
    component.toggleLinkAdd();
    component.linkTargetControl.setValue(77);
    component.onLinkTargetPicked({ id: 77, jobNumber: 'WO-0077', title: 'Fixture' });

    component.togglePartAdd();
    component.toggleLinkAdd();
    component.togglePartAdd();
    component.toggleLinkAdd();

    expect(component.selectedPartId()).toBeNull();
    expect(component.partPickerControl.value).toBeNull();
    expect(component.partQtyControl.value).toBe(1);
    expect(component.canAddPart()).toBe(false);
    expect(component.selectedLinkTargetId()).toBeNull();
    expect(component.linkTargetControl.value).toBeNull();
    component.addPart();
    component.addLink();
    expect(kanban.addJobPart).not.toHaveBeenCalled();
    expect(kanban.createJobLink).not.toHaveBeenCalled();
  });

  it('adds the picked part with the entered quantity and resets the picker', () => {
    const { component, kanban } = setup();
    kanban.addJobPart.mockReturnValue(of(jobPart({ quantity: 25 })));
    component.partPickerControl.setValue(9);
    component.onPartPicked(PART_ROW);
    component.partQtyControl.setValue(25);

    component.addPart();

    expect(kanban.addJobPart).toHaveBeenCalledWith(JOB_ID, 9, 25);
    expect(component.jobParts().map(p => p.quantity)).toEqual([25]);
    expect(component.partQtyControl.value).toBe(1);
    expect(component.selectedPartId()).toBeNull();
    expect(component.partPickerControl.value).toBeNull();
  });

  it('clears the picked part when the picker selection is cleared', () => {
    const { component } = setup();
    component.onPartPicked(PART_ROW);
    component.onPartPicked(null);
    expect(component.selectedPartId()).toBeNull();
    expect(component.canAddPart()).toBe(false);
  });

  it('refuses to add a part that is already on the work order', () => {
    const { component, kanban, snackbar } = setup();
    component.jobParts.set([jobPart()]);
    component.onPartPicked(PART_ROW);

    component.addPart();

    expect(kanban.addJobPart).not.toHaveBeenCalled();
    expect(snackbar.error).toHaveBeenCalledWith('jobDetailExtras.partDuplicate');
  });

  it('refuses to add a part when the quantity is not above zero', () => {
    const { component, kanban } = setup();
    component.onPartPicked(PART_ROW);
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

  it('links the picked work order and resets the picker', () => {
    const { component, kanban } = setup();
    kanban.createJobLink.mockReturnValue(of(jobLink({ linkedJobId: 77 })));
    component.linkTargetControl.setValue(77);
    component.onLinkTargetPicked({ id: 77, jobNumber: 'WO-0077', title: 'Fixture' });

    component.addLink();

    expect(kanban.createJobLink).toHaveBeenCalledWith(JOB_ID, 77, 'RelatedTo');
    expect(component.links().map(l => l.linkedJobId)).toEqual([77]);
    expect(component.selectedLinkTargetId()).toBeNull();
    expect(component.linkTargetControl.value).toBeNull();
  });

  it('refuses to link a work order to itself or to one already linked', () => {
    const { component, kanban, snackbar } = setup();
    component.onLinkTargetPicked({ id: JOB_ID });
    component.addLink();
    expect(snackbar.error).toHaveBeenCalledWith('jobDetailExtras.linkSelf');

    component.links.set([jobLink({ linkedJobId: 77 })]);
    component.onLinkTargetPicked({ id: 77 });
    component.addLink();
    expect(snackbar.error).toHaveBeenCalledWith('jobDetailExtras.linkDuplicate');
    expect(kanban.createJobLink).not.toHaveBeenCalled();
  });

  it('archives the work order through the bulk endpoint after confirming', () => {
    const { component, kanban, snackbar, dialog } = setup({ confirm: true });
    component.job.set(jobDetail());
    kanban.bulkArchive.mockReturnValue(of({ successCount: 1, failureCount: 0, errors: [] }));

    component.archiveJob();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(kanban.bulkArchive).toHaveBeenCalledWith([JOB_ID]);
    expect(component.job()?.isArchived).toBe(true);
    expect(snackbar.success).toHaveBeenCalledWith('jobDetailExtras.archived');
  });

  it('does not archive when the confirm dialog is cancelled', () => {
    const { component, kanban } = setup({ confirm: false });
    component.job.set(jobDetail());

    component.archiveJob();

    expect(kanban.bulkArchive).not.toHaveBeenCalled();
    expect(component.job()?.isArchived).toBe(false);
  });

  it('keeps the work order active and reports an error when the server archives nothing', () => {
    const { component, kanban, snackbar } = setup({ confirm: true });
    component.job.set(jobDetail());
    kanban.bulkArchive.mockReturnValue(of({ successCount: 0, failureCount: 1, errors: [{ jobId: JOB_ID, message: 'x' }] }));

    component.archiveJob();

    expect(component.job()?.isArchived).toBe(false);
    expect(snackbar.error).toHaveBeenCalledWith('jobDetailExtras.archiveFailed');
  });

  it('lets an Admin unarchive an archived work order', () => {
    const { component, kanban, snackbar } = setup({ admin: true, confirm: true });
    component.job.set(jobDetail({ isArchived: true }));
    kanban.unarchiveJob.mockReturnValue(of({ successCount: 1, failureCount: 0, errors: [] }));

    expect(component.isAdmin()).toBe(true);
    component.unarchiveJob();

    expect(kanban.unarchiveJob).toHaveBeenCalledWith(JOB_ID);
    expect(component.job()?.isArchived).toBe(false);
    expect(snackbar.success).toHaveBeenCalledWith('jobDetailExtras.unarchived');
  });

  it('does not unarchive for a non-Admin', () => {
    const { component, kanban, dialog } = setup({ admin: false });
    component.job.set(jobDetail({ isArchived: true }));

    expect(component.isAdmin()).toBe(false);
    component.unarchiveJob();

    expect(dialog.open).not.toHaveBeenCalled();
    expect(kanban.unarchiveJob).not.toHaveBeenCalled();
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
