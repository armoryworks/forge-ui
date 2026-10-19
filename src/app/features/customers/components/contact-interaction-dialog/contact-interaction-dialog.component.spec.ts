import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ContactInteractionDialogComponent, ContactInteractionDialogData } from './contact-interaction-dialog.component';
import { CustomerService } from '../../services/customer.service';
import { ContactInteraction } from '../../models/contact-interaction.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DialogInternals {
  form: FormGroup;
  save(): void;
}

describe('ContactInteractionDialogComponent follow-up date', () => {
  let customerService: {
    getCustomerById: ReturnType<typeof vi.fn>;
    createInteraction: ReturnType<typeof vi.fn>;
    updateInteraction: ReturnType<typeof vi.fn>;
  };

  function dialog(data: ContactInteractionDialogData): DialogInternals {
    customerService = {
      getCustomerById: vi.fn(() => of({ contacts: [] })),
      createInteraction: vi.fn(() => of({ id: 1 })),
      updateInteraction: vi.fn(() => of({ id: 1 })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: CustomerService, useValue: customerService },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    return TestBed.runInInjectionContext(() => new ContactInteractionDialogComponent()) as unknown as DialogInternals;
  }

  it('sends the follow-up date when one is picked on a new interaction', () => {
    const d = dialog({ customerId: 4, interaction: null });
    d.form.patchValue({ subject: 'Past-due balance', interactionDate: new Date(2026, 9, 19), followUpDate: new Date(2026, 9, 26) });

    d.save();

    expect(customerService.createInteraction).toHaveBeenCalledWith(4, expect.objectContaining({
      subject: 'Past-due balance',
      followUpDate: '2026-10-26T00:00:00Z',
    }));
  });

  it('leaves the follow-up date out when none is picked', () => {
    const d = dialog({ customerId: 4, interaction: null });
    d.form.patchValue({ subject: 'Checked in' });

    d.save();

    expect(customerService.createInteraction.mock.calls[0][1].followUpDate).toBeUndefined();
  });

  it('never sends a follow-up date when editing', () => {
    const existing = {
      id: 9, contactId: null, type: 'Call', subject: 'Old', body: null,
      interactionDate: '2026-10-01T00:00:00Z', durationMinutes: null,
    } as unknown as ContactInteraction;
    const d = dialog({ customerId: 4, interaction: existing });
    d.form.patchValue({ followUpDate: new Date(2026, 9, 26) });

    d.save();

    expect(customerService.updateInteraction.mock.calls[0][2].followUpDate).toBeUndefined();
  });
});
