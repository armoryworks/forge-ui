import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { WorkInstructionsComponent } from './work-instructions.component';
import { ControlledDocumentService } from '../../services/controlled-document.service';
import { WorkInstruction } from '../../models/work-instruction.model';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { FileDownloadService } from '../../../../shared/services/file-download.service';

const WI: WorkInstruction = {
  documentId: 5, documentNumber: 'DOC-00005', title: 'Turning WI', description: null, revisionId: 9, revisionNumber: 2,
  fileAttachmentId: 41, fileName: 'wi.pdf', contentType: 'application/pdf', approvedAt: null, partId: 1, operationId: 30,
};

describe('WorkInstructionsComponent', () => {
  let enabled: boolean;
  let workInstructions: ReturnType<typeof vi.fn>;
  let openOrDownload: ReturnType<typeof vi.fn>;

  function render() {
    workInstructions = vi.fn(() => of([WI]));
    openOrDownload = vi.fn();
    TestBed.configureTestingModule({
      imports: [WorkInstructionsComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ControlledDocumentService, useValue: { workInstructions, fileDownloadUrl: (id: number) => `/files/${id}/download` } },
        { provide: CapabilityService, useValue: { isEnabled: () => enabled } },
        { provide: FileDownloadService, useValue: { openOrDownload } },
      ],
    });
    const fixture = TestBed.createComponent(WorkInstructionsComponent);
    fixture.componentRef.setInput('operationId', 30);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    enabled = true;
  });

  it('shows the current work instruction for the operation and opens it', () => {
    const el = render();

    expect(workInstructions).toHaveBeenCalledWith(30);
    (el.querySelector('[data-testid="work-instruction-5"]') as HTMLButtonElement).click();
    expect(openOrDownload).toHaveBeenCalledWith('/files/41/download', 'wi.pdf', 'application/pdf');
  });

  it('shows nothing and asks for nothing when controlled documents are off', () => {
    enabled = false;
    const el = render();

    expect(workInstructions).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="work-instructions-30"]')).toBeNull();
  });
});
