import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CustomerInvoicesTabComponent, statementFileName } from './customer-invoices-tab.component';
import { CustomerService } from '../../../services/customer.service';
import { AuthService } from '../../../../../shared/services/auth.service';

interface TabInternals {
  canDownloadStatement: boolean;
  downloadingStatement(): boolean;
  downloadStatement(): void;
}

describe('CustomerInvoicesTabComponent statement', () => {
  let getStatementPdf: ReturnType<typeof vi.fn>;

  function tab(roles: string[]): TabInternals {
    getStatementPdf = vi.fn(() => of(new Blob(['%PDF'], { type: 'application/pdf' })));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService(),
        { provide: CustomerService, useValue: { getStatementPdf } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    const fixture = TestBed.createComponent(CustomerInvoicesTabComponent);
    fixture.componentRef.setInput('customerId', 12);
    fixture.componentRef.setInput('customerName', 'Acme Fabrication');
    return fixture.componentInstance as unknown as TabInternals;
  }

  it('offers the statement to the commercial roles only', () => {
    expect(tab(['OfficeManager']).canDownloadStatement).toBe(true);
    TestBed.resetTestingModule();
    expect(tab(['Engineer', 'PM']).canDownloadStatement).toBe(false);
  });

  it('downloads the customer statement PDF', () => {
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    const createObjectURL = vi.fn(() => 'blob:statement');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    try {
      const t = tab(['Admin']);

      t.downloadStatement();

      expect(getStatementPdf).toHaveBeenCalledWith(12);
      expect(createObjectURL).toHaveBeenCalled();
      expect(t.downloadingStatement()).toBe(false);
    } finally {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });

  it('names the file after the customer and the date', () => {
    expect(statementFileName('Acme Fabrication, Inc.', 12, new Date(2026, 9, 19)))
      .toBe('statement-acme-fabrication-inc-2026-10-19.pdf');
    expect(statementFileName(null, 12, new Date(2026, 0, 5))).toBe('statement-12-2026-01-05.pdf');
  });
});
