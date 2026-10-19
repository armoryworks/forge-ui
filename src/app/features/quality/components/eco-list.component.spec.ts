import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { EcoListComponent } from './eco-list.component';
import { EcoService } from '../services/eco.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { Eco, EcoAffectedItem } from '../models/eco.model';

interface EcoView {
  selectedEco: WritableSignal<Eco | null>;
  canSubmit(eco: Eco): boolean;
  canApprove(eco: Eco): boolean;
  submitForReview(): void;
}

describe('EcoListComponent submit for review', () => {
  let submitEco: ReturnType<typeof vi.fn>;
  let updateEco: ReturnType<typeof vi.fn>;
  let view: EcoView;
  const draft = { id: 9, status: 'Draft', ecoNumber: 'ECO-9' } as Eco;

  beforeEach(() => {
    TestBed.resetTestingModule();
    submitEco = vi.fn(() => of(undefined));
    updateEco = vi.fn(() => of(draft));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        {
          provide: EcoService,
          useValue: {
            submitEco,
            updateEco,
            getEcos: vi.fn(() => of([])),
            getEcoById: vi.fn(() => of({ ...draft, status: 'Review' })),
          },
        },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    });
    view = TestBed.runInInjectionContext(() => new EcoListComponent()) as unknown as EcoView;
  });

  it('offers submit only on a draft ECO', () => {
    expect(view.canSubmit(draft)).toBe(true);
    expect(view.canSubmit({ ...draft, status: 'Review' })).toBe(false);
    expect(view.canApprove({ ...draft, status: 'Review' })).toBe(true);
  });

  it('posts to the submit endpoint instead of patching the ECO', () => {
    view.selectedEco.set(draft);

    view.submitForReview();

    expect(submitEco).toHaveBeenCalledWith(9);
    expect(updateEco).not.toHaveBeenCalled();
    expect(view.selectedEco()?.status).toBe('Review');
  });
});

describe('EcoListComponent remove affected item', () => {
  it('names the item in the confirm', () => {
    TestBed.resetTestingModule();
    const open = vi.fn(() => ({ afterClosed: () => of(false) }));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: EcoService, useValue: { getEcos: vi.fn(() => of([])) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: MatDialog, useValue: { open } },
      ],
    });
    const view = TestBed.runInInjectionContext(() => new EcoListComponent()) as unknown as {
      selectedEco: WritableSignal<Eco | null>;
      deleteAffectedItem(item: EcoAffectedItem): void;
    };
    view.selectedEco.set({ id: 9, status: 'Draft', ecoNumber: 'ECO-9' } as Eco);

    view.deleteAffectedItem({ id: 4, entityType: 'Part', entityId: 9, changeDescription: 'Wall 3.0 -> 3.2 mm', isImplemented: false });

    expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      data: expect.objectContaining({ details: ['Part 9: Wall 3.0 -> 3.2 mm'] }),
    }));
  });
});
