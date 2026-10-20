import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { WatchtowerComponent } from './watchtower.component';
import { WatchtowerService } from './services/watchtower.service';
import { CalendarService } from '../calendar/services/calendar.service';
import { SnackbarService } from '../../shared/services/snackbar.service';

interface WatchtowerInternals {
  poll(): void;
  applyProposal(p: { id: number; title: string }): void;
  domainLabel(domain: string): string;
  feedTypeLabel(feedType: string): string;
  statusLabel(status: string): string;
}

describe('WatchtowerComponent', () => {
  let poll: ReturnType<typeof vi.fn>;
  let snackbar: { success: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  let dialogOpen: ReturnType<typeof vi.fn>;

  function create(): WatchtowerInternals {
    return TestBed.runInInjectionContext(() => new WatchtowerComponent()) as unknown as WatchtowerInternals;
  }

  beforeEach(() => {
    poll = vi.fn();
    snackbar = { success: vi.fn(), info: vi.fn(), warn: vi.fn() };
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(undefined) }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: WatchtowerService, useValue: { getProposals: () => of([]), getSources: () => of([]), poll } },
        { provide: CalendarService, useValue: { getSuperGroups: () => of([]) } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ tab: 'proposals' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
  });

  it('says nothing was polled when no source is active', () => {
    poll.mockReturnValue(of({ created: 0, activeSources: 0, failedSources: 0 }));

    create().poll();

    expect(snackbar.info).toHaveBeenCalledWith('watchtower.noActiveSources');
    expect(snackbar.success).not.toHaveBeenCalled();
  });

  it('reports new proposals when sources were polled', () => {
    poll.mockReturnValue(of({ created: 2, activeSources: 3, failedSources: 0 }));

    create().poll();

    expect(snackbar.success).toHaveBeenCalledWith('watchtower.polled');
    expect(snackbar.info).not.toHaveBeenCalled();
  });

  it('warns when some sources could not be reached', () => {
    poll.mockReturnValue(of({ created: 1, activeSources: 3, failedSources: 2 }));

    create().poll();

    expect(snackbar.warn).toHaveBeenCalledWith('watchtower.polledWithFailures');
    expect(snackbar.success).not.toHaveBeenCalled();
  });

  it('opens the apply dialog with focus on its first field', () => {
    create().applyProposal({ id: 1, title: 'New rule' });

    expect(dialogOpen.mock.calls[0][1]).toMatchObject({ autoFocus: 'input' });
  });

  it('labels feed types and domain slugs for people', () => {
    const component = create();

    expect(component.feedTypeLabel('Api')).toBe('watchtower.feedType.api');
    expect(component.domainLabel('cross-cutting')).toBe('watchtower.domain.crossCutting');
    expect(component.domainLabel('medical-devices')).toBe('Medical Devices');
  });

  it('labels proposal statuses through translation keys', () => {
    const component = create();

    expect(component.statusLabel('Pending')).toBe('watchtower.status.pending');
    expect(component.statusLabel('Applied')).toBe('watchtower.status.applied');
    expect(component.statusLabel('Dismissed')).toBe('watchtower.status.dismissed');
  });
});
