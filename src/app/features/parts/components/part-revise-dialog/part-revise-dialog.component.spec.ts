import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PartsService } from '../../services/parts.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartRevision } from '../../models/part-revision.model';
import { nextRevisionCode, PartReviseDialogComponent } from './part-revise-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type DialogInternals = {
  form: PartReviseDialogComponent['form'];
};

describe('nextRevisionCode', () => {
  it.each([
    ['A', 'B'],
    ['Z', 'AA'],
    ['AZ', 'BA'],
    ['b', 'c'],
    ['1', '2'],
    ['09', '10'],
    ['A9', 'A10'],
    ['', 'A'],
    [null, 'A'],
  ])('moves %s to %s', (current, expected) => {
    expect(nextRevisionCode(current)).toBe(expected);
  });

  it('skips codes the part already used', () => {
    expect(nextRevisionCode('A', ['B', 'c'])).toBe('D');
  });
});

describe('PartReviseDialogComponent', () => {
  const part = { id: 4, partNumber: 'PRT-00007', revision: 'A' } as PartDetail;
  const created: PartRevision = {
    id: 9, partId: 4, revision: 'B', changeDescription: null, changeReason: 'Thicker wall',
    effectiveDate: new Date('2026-10-08T00:00:00Z'), isCurrent: true, fileCount: 0,
    createdAt: new Date('2026-10-08T00:00:00Z'),
  };
  let createRevision: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  function create(): PartReviseDialogComponent {
    return TestBed.runInInjectionContext(() => new PartReviseDialogComponent());
  }

  beforeEach(() => {
    createRevision = vi.fn().mockReturnValue(of(created));
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: PartsService, useValue: { createRevision } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { part, revisions: [] } },
      ],
    });
  });

  it('prefills the next revision and today, and requires a reason', () => {
    const form = (create() as unknown as DialogInternals).form;
    const today = new Date();

    expect(form.controls.revision.value).toBe('B');
    expect(form.controls.effectiveDate.value?.toDateString()).toBe(today.toDateString());
    expect(form.controls.changeReason.hasError('required')).toBe(true);
    expect(form.invalid).toBe(true);
  });

  it('rejects a revision code longer than the part column', () => {
    const form = (create() as unknown as DialogInternals).form;
    form.controls.revision.setValue('ABCDEFGHIJK');

    expect(form.controls.revision.hasError('maxlength')).toBe(true);
  });

  it('creates the revision and closes with it', () => {
    const dialog = create();
    const form = (dialog as unknown as DialogInternals).form;
    form.controls.changeReason.setValue('  Thicker wall ');
    form.controls.effectiveDate.setValue(new Date(2026, 9, 8));

    dialog.save();

    expect(createRevision).toHaveBeenCalledWith(4, {
      revision: 'B',
      changeReason: 'Thicker wall',
      effectiveDate: '2026-10-08T00:00:00Z',
    });
    expect(close).toHaveBeenCalledWith(created);
  });

  it('does not submit without a reason', () => {
    create().save();

    expect(createRevision).not.toHaveBeenCalled();
  });
});
