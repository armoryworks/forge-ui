import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ProjectDeliverablesComponent } from './project-deliverables.component';
import { DeliverableService } from '../../services/deliverable.service';
import { Deliverable } from '../../models/deliverable.model';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EntityPreviewService } from '../../../../shared/services/entity-preview.service';

const DRAFT = {
  id: 6, name: 'Inspection report', description: null, jobId: null, projectId: 2, customerId: 4, deliverableTypeId: 1,
  status: 'Draft', dueDate: null, deliveredAt: null, deliveredByUserId: null, fileAttachmentIds: null, cloudLinkExternalId: null,
  createdAt: '', updatedAt: '',
} as Deliverable;

describe('ProjectDeliverablesComponent', () => {
  let update: ReturnType<typeof vi.fn>;
  let roles: string[];

  function render() {
    update = vi.fn(() => of({ ...DRAFT, status: 'In Review' }));
    TestBed.configureTestingModule({
      imports: [ProjectDeliverablesComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: DeliverableService, useValue: { listForProject: vi.fn(() => of({ items: [DRAFT] })), update, delete: vi.fn(() => of(undefined)) } },
        { provide: ReferenceDataService, useValue: { getByGroup: vi.fn(() => of([{ id: 1, label: 'Report', isActive: true }])) } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: EntityPreviewService, useValue: { getPreview: vi.fn(() => of(null)) } },
      ],
    });
    const fixture = TestBed.createComponent(ProjectDeliverablesComponent);
    fixture.componentRef.setInput('projectId', 2);
    fixture.componentRef.setInput('customerId', 4);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    roles = ['Engineer'];
  });

  it('walks a draft deliverable to review', () => {
    const { fixture, el } = render();
    expect(el.querySelector('[data-testid="deliverable-6"]')?.textContent).toContain('Report');

    (el.querySelector('[data-testid="deliverable-step-6-In Review"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(update).toHaveBeenCalledWith(6, expect.objectContaining({ status: 'In Review', deliverableTypeId: 1, projectId: 2 }));
    expect(el.querySelector('[data-testid="deliverable-status-6"]')?.textContent).toContain('deliverables.statusInReview');
  });

  it('offers delete to the PM but not to an engineer', () => {
    expect(render().el.querySelector('[data-testid="deliverable-delete-6"]')).toBeNull();

    TestBed.resetTestingModule();
    roles = ['PM'];
    expect(render().el.querySelector('[data-testid="deliverable-delete-6"]')).not.toBeNull();
  });
});
