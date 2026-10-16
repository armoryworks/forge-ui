import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { TelLinkOutboundService } from '../../../../shared/services/outbound-call.service';
import { LeadsService } from '../../services/leads.service';
import { QueueLead } from '../../models/queue.model';
import { OutreachPreferencesDialogComponent } from '../../components/outreach-preferences-dialog/outreach-preferences-dialog.component';
import { LeadsQueueComponent } from './leads-queue.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = {
  batch: { set(v: QueueLead[]): void };
  actions: { state: string }[];
  dispose(action: { state: string }): void;
};

describe('LeadsQueueComponent suppress', () => {
  let dialogResult: unknown;
  let opened: unknown[];
  let disposition: ReturnType<typeof vi.fn>;

  function queue(): Internals {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: LeadsService, useValue: { dispositionLead: disposition } },
        { provide: SnackbarService, useValue: { success: vi.fn(), info: vi.fn(), error: vi.fn() } },
        { provide: TelLinkOutboundService, useValue: { placeCall: () => of({ ok: true }) } },
        {
          provide: MatDialog,
          useValue: { open: (cmp: unknown) => { opened.push(cmp); return { afterClosed: () => of(dialogResult) }; } },
        },
      ],
    });
    const c = TestBed.runInInjectionContext(() => new LeadsQueueComponent()) as unknown as Internals;
    c.batch.set([{ id: 4, companyName: 'Acme', contactName: null } as QueueLead]);
    return c;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    opened = [];
    disposition = vi.fn(() => of(undefined));
  });

  it('asks for the opt-outs first and only dispositions once they are saved', () => {
    dialogResult = { emailOptOut: true };
    const c = queue();

    c.dispose(c.actions.find((a) => a.state === 'Suppressed')!);

    expect(opened).toEqual([OutreachPreferencesDialogComponent]);
    expect(disposition).toHaveBeenCalledWith(4, expect.objectContaining({ nextState: 'Suppressed' }));
  });

  it('leaves the lead on the queue when the preferences dialog is cancelled', () => {
    dialogResult = undefined;
    const c = queue();

    c.dispose(c.actions.find((a) => a.state === 'Suppressed')!);

    expect(disposition).not.toHaveBeenCalled();
  });
});
