import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ControlledDocumentDetailDialogComponent } from './controlled-document-detail-dialog.component';
import { ControlledDocumentService } from '../../services/controlled-document.service';
import { ControlledDocument } from '../../models/controlled-document.model';
import { DocumentRevision } from '../../models/document-revision.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { FileDownloadService } from '../../../../shared/services/file-download.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DialogApi {
  document(): ControlledDocument;
  canRevise(): boolean;
  canApprove: boolean;
  changeDescription: { setValue(v: string): void };
  onUploaded(file: { id: string; fileName: string }): void;
  saveRevision(): void;
  approve(r: DocumentRevision): void;
  obsolete(): void;
  close(): void;
}

const DOC = { id: 5, documentNumber: 'DOC-00005', title: 'Turning WI', status: 'Draft', currentRevision: 0 } as unknown as ControlledDocument;

function setup(roles: string[], revisions: Partial<DocumentRevision>[]) {
  const service = {
    revisions: vi.fn(() => of(revisions)),
    createRevision: vi.fn(() => of({ id: 9 })),
    approveRevision: vi.fn(() => of({ id: 9 })),
    obsolete: vi.fn(() => of(undefined)),
  };
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ControlledDocumentService, useValue: service },
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { document: DOC } },
      { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(true) })) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: FileDownloadService, useValue: { openOrDownload: vi.fn() } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  const dialog = TestBed.runInInjectionContext(() => new ControlledDocumentDetailDialogComponent()) as unknown as DialogApi;
  return { dialog, service, close };
}

describe('ControlledDocumentDetailDialogComponent', () => {
  it('creates a revision from the uploaded file and its change description', () => {
    const { dialog, service } = setup(['Engineer'], []);
    expect(dialog.canRevise()).toBe(true);

    dialog.onUploaded({ id: '41', fileName: 'wi.pdf' });
    dialog.changeDescription.setValue('  First release ');
    dialog.saveRevision();

    expect(service.createRevision).toHaveBeenCalledWith(5, 41, 'First release');
  });

  it('allows no new revision while one is in draft or review', () => {
    expect(setup(['Engineer'], [{ id: 2, status: 'InReview', revisionNumber: 1 }]).dialog.canRevise()).toBe(false);
  });

  it('lets an approver release a revision in review and reports the change on close', () => {
    const { dialog, service, close } = setup(['ComplianceOfficer'], [{ id: 2, status: 'InReview', revisionNumber: 1 }]);

    dialog.approve({ id: 2, revisionNumber: 1 } as DocumentRevision);
    expect(service.approveRevision).toHaveBeenCalledWith(5, 2);
    expect(dialog.document().status).toBe('Released');
    expect(dialog.document().currentRevision).toBe(1);

    dialog.close();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('keeps approval away from engineers', () => {
    expect(setup(['Engineer'], []).dialog.canApprove).toBe(false);
  });

  it('makes the document obsolete once confirmed', () => {
    const { dialog, service } = setup(['Manager'], []);

    dialog.obsolete();

    expect(service.obsolete).toHaveBeenCalledWith(5);
    expect(dialog.document().status).toBe('Obsolete');
  });
});
