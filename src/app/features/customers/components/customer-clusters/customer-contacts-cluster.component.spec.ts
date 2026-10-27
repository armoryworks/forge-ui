import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { CustomerService } from '../../services/customer.service';
import { Contact } from '../../models/contact.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import {
  OutreachPreferencesDialogComponent, OutreachPreferencesDialogData,
} from '../../../leads/components/outreach-preferences-dialog/outreach-preferences-dialog.component';
import { CustomerContactsClusterComponent } from './customer-contacts-cluster.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const contact = { id: 31, firstName: 'Ada', lastName: 'Lovelace', isPrimary: true } as Contact;

describe('CustomerContactsClusterComponent', () => {
  let dialog: { open: ReturnType<typeof vi.fn> };
  let customers: {
    getCustomerById: ReturnType<typeof vi.fn>;
    getContactOutreachPreferences: ReturnType<typeof vi.fn>;
    updateContactOutreachPreferences: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    dialog = { open: vi.fn() };
    customers = {
      getCustomerById: vi.fn(() => of({ contacts: [contact] })),
      getContactOutreachPreferences: vi.fn(() => of(null)),
      updateContactOutreachPreferences: vi.fn(() => of({})),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MatDialog, useValue: dialog },
        { provide: CustomerService, useValue: customers },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
  });

  it('opens the outreach preferences dialog wired to the customer contact endpoints', () => {
    const cluster = TestBed.runInInjectionContext(() => new CustomerContactsClusterComponent());
    mockSignalInputs(cluster, { customerId: 7 });
    const internals = cluster as unknown as { openOutreachPreferences(c: Contact): void };

    internals.openOutreachPreferences(contact);

    expect(dialog.open).toHaveBeenCalledWith(OutreachPreferencesDialogComponent, expect.anything());
    const data = dialog.open.mock.calls[0][1].data as OutreachPreferencesDialogData;
    expect(data.leadName).toBe('Lovelace, Ada');
    expect(data.leadId).toBeUndefined();
    data.source!.load().subscribe();
    data.source!.save({ emailOptOut: true }).subscribe();
    expect(customers.getContactOutreachPreferences).toHaveBeenCalledWith(7, 31);
    expect(customers.updateContactOutreachPreferences).toHaveBeenCalledWith(7, 31, { emailOptOut: true });
  });
});
