import { ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Navigation, Router } from '@angular/router';

import { DraftService } from '../../services/draft.service';
import { DialogComponent } from './dialog.component';

describe('DialogComponent draft lifecycle', () => {
  let draftService: { register: ReturnType<typeof vi.fn>; unregister: ReturnType<typeof vi.fn>; loadDraft: ReturnType<typeof vi.fn>; clearDraft: ReturnType<typeof vi.fn> };
  let currentNavigation: ReturnType<typeof signal<Navigation | null>>;

  beforeEach(() => {
    draftService = {
      register: vi.fn(),
      unregister: vi.fn(),
      loadDraft: vi.fn().mockResolvedValue(null),
      clearDraft: vi.fn().mockResolvedValue(undefined),
    };
    currentNavigation = signal<Navigation | null>(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { openDialogs: [], open: vi.fn() } },
        { provide: DraftService, useValue: draftService },
        { provide: Router, useValue: { currentNavigation } },
        { provide: ElementRef, useValue: new ElementRef(document.createElement('app-dialog')) },
      ],
    });
  });

  function createDialog(): DialogComponent {
    const fixture = TestBed.runInInjectionContext(() => new DialogComponent());
    const inputs = fixture as unknown as {
      draftConfig: () => unknown;
      draftFormGroup: () => unknown;
      title: () => string;
    };
    const form = new FormGroup({ name: new FormControl('Acme') });
    Object.defineProperty(inputs, 'draftConfig', { value: () => ({ entityType: 'lead', entityId: 'new', route: '/leads' }) });
    Object.defineProperty(inputs, 'draftFormGroup', { value: () => form });
    Object.defineProperty(inputs, 'title', { value: () => 'New Lead' });
    fixture.ngOnInit();
    return fixture;
  }

  function destroy(): void {
    TestBed.resetTestingModule();
  }

  it('discards the draft when the dialog is closed by the user', () => {
    createDialog();

    destroy();

    expect(draftService.unregister).toHaveBeenCalledWith('lead', 'new');
    expect(draftService.clearDraft).toHaveBeenCalledWith('lead', 'new');
  });

  it('keeps the draft when the dialog is torn down by a route navigation', () => {
    createDialog();
    currentNavigation.set({} as Navigation);

    destroy();

    expect(draftService.unregister).toHaveBeenCalledWith('lead', 'new');
    expect(draftService.clearDraft).not.toHaveBeenCalled();
  });
});
