import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ControlledDocumentsComponent } from './controlled-documents.component';
import { ControlledDocumentService } from '../../services/controlled-document.service';
import { ControlledDocument } from '../../models/controlled-document.model';
import { AuthService } from '../../../../shared/services/auth.service';

interface PageApi {
  canAuthor: boolean;
  documents(): ControlledDocument[];
  categoryFilter: { setValue(v: string | null): void };
  load(): void;
  openCreate(): void;
}

function setup(roles: string[]) {
  const list = vi.fn(() => of([{ id: 1, documentNumber: 'DOC-00001' } as ControlledDocument]));
  const open = vi.fn((_component: unknown, _config?: unknown) => ({ afterClosed: () => of({ id: 2, documentNumber: 'DOC-00002' }) }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ControlledDocumentService, useValue: { list } },
      { provide: MatDialog, useValue: { open } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  return { page: TestBed.runInInjectionContext(() => new ControlledDocumentsComponent()) as unknown as PageApi, list, open };
}

describe('ControlledDocumentsComponent', () => {
  it('lists documents and filters by category', () => {
    const { page, list } = setup(['ComplianceOfficer']);
    expect(page.documents()).toHaveLength(1);

    page.categoryFilter.setValue('WI');
    page.load();

    expect(list).toHaveBeenLastCalledWith({ category: 'WI', status: null });
  });

  it('opens a new document right after creating it so its first revision can be uploaded', () => {
    const { page, open } = setup(['Engineer']);

    page.openCreate();

    expect(open).toHaveBeenCalledTimes(2);
    expect(open.mock.calls[1][1]).toEqual(expect.objectContaining({ data: { document: { id: 2, documentNumber: 'DOC-00002' } } }));
  });

  it('does not let a production worker author documents', () => {
    expect(setup(['ProductionWorker']).page.canAuthor).toBe(false);
  });
});
