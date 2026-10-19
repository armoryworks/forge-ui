import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject, throwError } from 'rxjs';

import { PortalQuotesComponent } from './portal-quotes.component';
import { PortalService } from '../services/portal.service';
import { PortalQuote } from '../models/portal.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';

describe('PortalQuotesComponent · respond', () => {
  let respondToQuote: ReturnType<typeof vi.fn>;
  let view: { respond(quote: PortalQuote, accepted: boolean): void };

  beforeEach(() => {
    TestBed.resetTestingModule();
    respondToQuote = vi.fn(() => new Subject());
    TestBed.configureTestingModule({
      providers: [
        { provide: PortalService, useValue: { respondToQuote, getQuotes: vi.fn(() => new Subject()) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    view = TestBed.runInInjectionContext(() => new PortalQuotesComponent()) as unknown as typeof view;
  });

  it('sends one answer when Accept is pressed twice before the server answers', () => {
    view.respond({ id: 8 } as PortalQuote, true);
    view.respond({ id: 8 } as PortalQuote, true);

    expect(respondToQuote).toHaveBeenCalledTimes(1);
  });

  it('lets the customer answer again after the server rejects the first answer', () => {
    respondToQuote.mockReturnValueOnce(throwError(() => new Error('500')));

    view.respond({ id: 8 } as PortalQuote, true);
    view.respond({ id: 8 } as PortalQuote, true);

    expect(respondToQuote).toHaveBeenCalledTimes(2);
  });
});
