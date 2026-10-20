import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { EcoListComponent } from './eco-list.component';
import { EcoService } from '../services/eco.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Eco } from '../models/eco.model';

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
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
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
