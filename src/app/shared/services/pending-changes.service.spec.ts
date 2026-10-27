import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { pendingChangesGuard } from '../guards/pending-changes.guard';
import { PendingChangesService } from './pending-changes.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function setup(answer: boolean): { service: PendingChangesService; open: ReturnType<typeof vi.fn> } {
  TestBed.resetTestingModule();
  const open = vi.fn(() => ({ afterClosed: () => of(answer) }));
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MatDialog, useValue: { open } },
    ],
  });
  return { service: TestBed.inject(PendingChangesService), open };
}

describe('PendingChangesService', () => {
  it('lets the user go without asking when nothing is unsaved', async () => {
    const { service, open } = setup(false);

    expect(await firstValueFrom(service.confirmDiscard())).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('asks while a holder is dirty and keeps the edits when the user stays', async () => {
    const { service, open } = setup(false);
    const editor = {};
    service.set(editor, true);

    expect(await firstValueFrom(service.confirmDiscard())).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
    expect(service.hasPending()).toBe(true);
  });

  it('clears every holder when the user discards', async () => {
    const { service } = setup(true);
    service.set({}, true);
    service.set({}, true);

    expect(await firstValueFrom(service.confirmDiscard())).toBe(true);
    expect(service.hasPending()).toBe(false);
  });

  it('stops asking once the holder saves', async () => {
    const { service, open } = setup(false);
    const editor = {};
    service.set(editor, true);
    service.set(editor, false);

    expect(await firstValueFrom(service.confirmDiscard())).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('asks once when several callers want to discard at the same time', () => {
    TestBed.resetTestingModule();
    const answer = new Subject<boolean>();
    const open = vi.fn(() => ({ afterClosed: () => answer.asObservable() }));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MatDialog, useValue: { open } },
      ],
    });
    const service = TestBed.inject(PendingChangesService);
    service.set({}, true);
    const results: boolean[] = [];

    service.confirmDiscard().subscribe(r => results.push(r));
    service.confirmDiscard().subscribe(r => results.push(r));
    answer.next(true);
    answer.complete();

    expect(open).toHaveBeenCalledTimes(1);
    expect(results).toEqual([true, true]);
    expect(service.hasPending()).toBe(false);
  });

  it('guards route deactivation with the same question', async () => {
    const { service, open } = setup(false);
    service.set({}, true);

    const result = TestBed.runInInjectionContext(() =>
      pendingChangesGuard(null, null as never, null as never, null as never)) as Observable<boolean>;

    expect(await firstValueFrom(result)).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
