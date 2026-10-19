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
  canExplodeBom: () => boolean;
  canArchive: () => boolean;
  canEditJob: () => boolean;
  canRemovePart(jp: JobPart): boolean;
  removePart(jp: JobPart): void;
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
  partQtyReadonly(jp: JobPart): boolean;
  canDispose(disposition: string | null): boolean;
  formatDisposition(disposition: string): string;
  timeEntries: { set(v: TimeEntry[]): void };
  hasActiveTimer: () => boolean;
  stopTimerForJob(): void;
  availableStages: { set(v: Stage[]): void };
  onAllOperationsComplete(): void;
  moveToStage(stage: Stage): void;
  quantityControl: FormControl<number | null>;
  canEditQuantity: () => boolean;
  saveQuantity(): void;
  quantityChanged: { subscribe(fn: () => void): unknown };
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

function setup(options: { admin?: boolean; confirm?: boolean; roles?: string[] } = {}) {
  const kanban = {
    addJobPart: vi.fn(),
    updateJobPart: vi.fn(),
    updateJob: vi.fn(),
    getJobDetail: vi.fn(),
    getJobParts: vi.fn().mockReturnValue(of([])),
    createJobLink: vi.fn(),
    bulkArchive: vi.fn(),
    unarchiveJob: vi.fn(),
    getJobTimeEntries: vi.fn().mockReturnValue(of([])),
    moveJobStage: vi.fn().mockReturnValue(of(undefined)),
    removeJobPart: vi.fn().mockReturnValue(of(undefined)),
  };
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
  const timeTracking = { stopTimer: vi.fn().mockReturnValue(of({})), startTimer: vi.fn() };
  const afterClosed = new Subject<unknown>();
  const dialog = {
    open: vi.fn(() => ({ afterClosed: () => (options.confirm === undefined ? afterClosed : of(options.confirm)) })),
  };
  const auth = {
    user: () => ({ id: 1 }),
    hasRole: vi.fn((role: string) => role === 'Admin' && !!options.admin),
    hasAnyRole: vi.fn((wanted: string[]) => wanted.some(r => (options.roles ?? (options.admin ? ['Admin'] : [])).includes(r))),
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

  it('offers edit only to the roles that can save a work order', () => {
    expect(setup({ roles: ['Manager'] }).component.canEditJob()).toBe(true);
    expect(setup({ roles: ['ProductionWorker'] }).component.canEditJob()).toBe(false);
  });

  it('lets any role remove a supporting part but only an editor remove the build part', () => {
    const worker = setup({ roles: ['ProductionWorker'] }).component;
    worker.job.set(jobDetail({ partId: 9 }));
    expect(worker.canRemovePart(jobPart({ partId: 9 }))).toBe(false);
    expect(worker.canRemovePart(jobPart({ id: 6, partId: 11 }))).toBe(true);

    const manager = setup({ roles: ['Manager'] }).component;
    manager.job.set(jobDetail({ partId: 9 }));
    expect(manager.canRemovePart(jobPart({ partId: 9 }))).toBe(true);
  });

  it('removes a part only after the confirm', () => {
    const declined = setup({ confirm: false });
    declined.component.jobParts.set([jobPart({ id: 6, partId: 11 })]);
    declined.component.removePart(jobPart({ id: 6, partId: 11 }));
    expect(declined.dialog.open).toHaveBeenCalled();
    expect(declined.kanban.removeJobPart).not.toHaveBeenCalled();

    const confirmed = setup({ confirm: true });
    confirmed.component.jobParts.set([jobPart({ id: 6, partId: 11 })]);
    confirmed.component.removePart(jobPart({ id: 6, partId: 11 }));
    expect(confirmed.kanban.removeJobPart).toHaveBeenCalledWith(JOB_ID, 6);
    expect(confirmed.component.jobParts()).toEqual([]);
  });

  it('offers Explode BOM only to the roles the explode endpoint admits', () => {
    expect(setup({ roles: ['Admin'] }).component.canExplodeBom()).toBe(true);
    expect(setup({ roles: ['Manager'] }).component.canExplodeBom()).toBe(true);
    expect(setup({ roles: ['ProductionWorker'] }).component.canExplodeBom()).toBe(false);
    expect(setup({ roles: ['Engineer'] }).component.canExplodeBom()).toBe(false);
  });

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

  it('lets only the roles that can edit a job change an open work order\'s quantity', () => {
    const open = jobDetail({ partId: 9, quantity: 1, completedDate: null, disposition: null });
    const manager = setup({ roles: ['Manager'] }).component;
    manager.job.set(open);
    expect(manager.canEditQuantity()).toBe(true);

    const worker = setup({ roles: ['ProductionWorker'] }).component;
    worker.job.set(open);
    expect(worker.canEditQuantity()).toBe(false);

    const admin = setup({ roles: ['Admin'] }).component;
    admin.job.set(jobDetail({ partId: null, quantity: null }));
    expect(admin.canEditQuantity()).toBe(false);
    admin.job.set({ ...open, disposition: 'ShipToCustomer' });
    expect(admin.canEditQuantity()).toBe(false);
    admin.job.set({ ...open, completedDate: new Date() });
    expect(admin.canEditQuantity()).toBe(false);
    admin.job.set({ ...open, isArchived: true });
    expect(admin.canEditQuantity()).toBe(false);
  });

  it('saves the job quantity through the job update and reloads the job, its parts and the board', () => {
    const { component, kanban, snackbar } = setup({ roles: ['Manager'] });
    component.job.set(jobDetail({ partId: 9, quantity: 1 }));
    kanban.updateJob.mockReturnValue(of({}));
    kanban.getJobDetail.mockReturnValue(of(jobDetail({ partId: 9, quantity: 300 })));
    kanban.getJobParts.mockReturnValue(of([jobPart({ quantity: 300 })]));
    const changed = vi.fn();
    component.quantityChanged.subscribe(changed);

    component.quantityControl.setValue(300);
    component.saveQuantity();

    expect(kanban.updateJob).toHaveBeenCalledWith(JOB_ID, { quantity: 300 });
    expect(snackbar.success).toHaveBeenCalledWith('kanban.quantityUpdated');
    expect(component.job()!.quantity).toBe(300);
    expect(component.quantityControl.value).toBe(300);
    expect(component.jobParts().map(p => p.quantity)).toEqual([300]);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('does not save an unchanged job quantity and restores an invalid or failed one', () => {
    const { component, kanban, snackbar } = setup({ roles: ['Admin'] });
    component.job.set(jobDetail({ partId: 9, quantity: 12 }));

    component.quantityControl.setValue(12);
    component.saveQuantity();
    expect(kanban.updateJob).not.toHaveBeenCalled();

    component.quantityControl.setValue(0);
    component.saveQuantity();
    expect(kanban.updateJob).not.toHaveBeenCalled();
    expect(component.quantityControl.value).toBe(12);

    const err = new Error('boom');
    kanban.updateJob.mockReturnValue(throwError(() => err));
    component.quantityControl.setValue(40);
    component.saveQuantity();
    expect(component.quantityControl.value).toBe(12);
    expect(snackbar.errorFrom).toHaveBeenCalledWith(err, 'kanban.quantityUpdateFailed');
  });

  it('leaves the first part\'s quantity on a sales-order work order to the server', () => {
    const { component, kanban } = setup();
    component.job.set(jobDetail({ partId: null, salesOrderId: 7, quantity: 300 }));
    kanban.addJobPart.mockReturnValue(of(jobPart({ quantity: 100 })));
    kanban.getJobDetail.mockReturnValue(of(jobDetail({ partId: 9, quantity: 100 })));

    component.togglePartAdd();
    expect(component.partQtyControl.value).toBeNull();

    component.onPartPicked(PART_ROW);
    expect(component.canAddPart()).toBe(true);
    component.addPart();

    expect(kanban.addJobPart).toHaveBeenCalledWith(JOB_ID, 9, undefined);
    expect(kanban.getJobDetail).toHaveBeenCalledWith(JOB_ID);
  });

  it('sends a typed first-part quantity on a sales-order work order', () => {
    const { component, kanban } = setup();
    component.job.set(jobDetail({ partId: null, salesOrderId: 7, quantity: 300 }));
    kanban.addJobPart.mockReturnValue(of(jobPart({ quantity: 40 })));
    kanban.getJobDetail.mockReturnValue(of(jobDetail({ partId: 9, quantity: 40 })));

    component.togglePartAdd();
    component.onPartPicked(PART_ROW);
    component.partQtyControl.setValue(40);
    component.addPart();

    expect(kanban.addJobPart).toHaveBeenCalledWith(JOB_ID, 9, 40);
  });

  it('starts the first part at one on a work order without a sales-order line', () => {
    const { component } = setup();
    component.job.set(jobDetail({ partId: null, salesOrderId: null, quantity: null }));

    component.togglePartAdd();

    expect(component.partQtyControl.value).toBe(1);
  });

  it('keeps the build part\'s quantity read-only in the parts list for roles that cannot edit the job', () => {
    const { component, kanban } = setup({ roles: ['ProductionWorker'] });
    const build = jobPart();
    const other = jobPart({ id: 6, partId: 10, quantity: 2 });
    component.job.set(jobDetail({ partId: 9, quantity: 25 }));
    component.jobParts.set([build, other]);

    expect(component.partQtyReadonly(build)).toBe(true);
    expect(component.partQtyReadonly(other)).toBe(false);
    component.partQtyEditControl(build).setValue(30);
    component.savePartQty(build);
    expect(kanban.updateJobPart).not.toHaveBeenCalled();
  });

  it('keeps the build part\'s quantity read-only in the parts list on a finished work order', () => {
    const { component } = setup({ roles: ['Admin'] });
    component.job.set(jobDetail({ partId: 9, quantity: 25, completedDate: new Date() }));

    expect(component.partQtyReadonly(jobPart())).toBe(true);
  });

  it('reloads the job after the build part\'s quantity is edited in the parts list', () => {
    const { component, kanban } = setup({ roles: ['Manager'] });
    const jp = jobPart();
    component.job.set(jobDetail({ partId: 9, quantity: 25 }));
    component.jobParts.set([jp]);
    kanban.updateJobPart.mockReturnValue(of({ ...jp, quantity: 30 }));
    kanban.getJobDetail.mockReturnValue(of(jobDetail({ partId: 9, quantity: 30 })));

    component.partQtyEditControl(jp).setValue(30);
    component.savePartQty(jp);

    expect(kanban.getJobDetail).toHaveBeenCalledWith(JOB_ID);
    expect(component.quantityControl.value).toBe(30);
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

  it('does not offer the next stage when it bills the customer and the role cannot bill', () => {
    const { component, dialog } = setup({ roles: ['ProductionWorker'] });
    component.job.set({ id: JOB_ID, currentStageId: 7, stageName: 'QC/Review', stageColor: '#000' } as unknown as JobDetail);
    component.availableStages.set([
      { id: 7, name: 'QC/Review', color: '#111', sortOrder: 7, accountingDocumentType: null },
      { id: 8, name: 'Shipped', color: '#222', sortOrder: 8, accountingDocumentType: 'Invoice' },
    ] as unknown as Stage[]);

    component.onAllOperationsComplete();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('moves into a billing stage only for a role that can bill', () => {
    const shipped = { id: 8, name: 'Shipped', color: '#222', sortOrder: 8, accountingDocumentType: 'Invoice' } as unknown as Stage;
    const worker = setup({ roles: ['PM'] });
    worker.component.job.set({ id: JOB_ID, currentStageId: 7 } as unknown as JobDetail);
    worker.component.moveToStage(shipped);
    expect(worker.kanban.moveJobStage).not.toHaveBeenCalled();

    const office = setup({ roles: ['OfficeManager'] });
    office.component.job.set({ id: JOB_ID, currentStageId: 7 } as unknown as JobDetail);
    office.component.moveToStage(shipped);
    expect(office.kanban.moveJobStage).toHaveBeenCalledWith(JOB_ID, 8);
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
    const { component, kanban, snackbar, dialog } = setup({ roles: ['Manager'], confirm: true });
    component.job.set(jobDetail());
    kanban.bulkArchive.mockReturnValue(of({ successCount: 1, failureCount: 0, errors: [] }));

    component.archiveJob();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(kanban.bulkArchive).toHaveBeenCalledWith([JOB_ID]);
    expect(component.job()?.isArchived).toBe(true);
    expect(snackbar.success).toHaveBeenCalledWith('jobDetailExtras.archived');
  });

  it('does not archive when the confirm dialog is cancelled', () => {
    const { component, kanban } = setup({ roles: ['Manager'], confirm: false });
    component.job.set(jobDetail());

    component.archiveJob();

    expect(kanban.bulkArchive).not.toHaveBeenCalled();
    expect(component.job()?.isArchived).toBe(false);
  });

  it('keeps the work order active and reports an error when the server archives nothing', () => {
    const { component, kanban, snackbar } = setup({ roles: ['Manager'], confirm: true });
    component.job.set(jobDetail());
    kanban.bulkArchive.mockReturnValue(of({ successCount: 0, failureCount: 1, errors: [{ jobId: JOB_ID, message: 'x' }] }));

    component.archiveJob();

    expect(component.job()?.isArchived).toBe(false);
    expect(snackbar.error).toHaveBeenCalledWith('jobDetailExtras.archiveFailed');
  });

  it('offers Archive only to the roles the archive endpoint admits', () => {
    expect(setup({ roles: ['Admin'] }).component.canArchive()).toBe(true);
    expect(setup({ roles: ['Manager'] }).component.canArchive()).toBe(true);
    expect(setup({ roles: ['ProductionWorker'] }).component.canArchive()).toBe(false);
    expect(setup({ roles: ['PM'] }).component.canArchive()).toBe(false);
  });

  it('does not archive for a production worker', () => {
    const { component, kanban, dialog } = setup({ roles: ['ProductionWorker'], confirm: true });
    component.job.set(jobDetail());

    component.archiveJob();

    expect(dialog.open).not.toHaveBeenCalled();
    expect(kanban.bulkArchive).not.toHaveBeenCalled();
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
