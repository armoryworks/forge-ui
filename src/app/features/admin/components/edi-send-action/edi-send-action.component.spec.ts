import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { EdiService } from '../../services/edi.service';
import { EdiTradingPartner } from '../../models/edi-trading-partner.model';
import { EdiTransaction } from '../../models/edi-transaction.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EdiSendActionComponent, EdiSendEntityType } from './edi-send-action.component';

const PARTNER = { id: 3, name: 'Buyer EDI', customerId: 42, isActive: true } as EdiTradingPartner;
const txn = (status: EdiTransaction['status'], isAcknowledged = false) =>
  ({ id: 9, status, isAcknowledged, receivedAt: '2026-10-20T10:00:00Z', errorMessage: null } as EdiTransaction);

interface Internals {
  allowed: Signal<boolean>;
  partner: Signal<EdiTradingPartner | null>;
  transactionSet: Signal<string>;
  outcome: Signal<string | null>;
  send(): void;
}

describe('EdiSendActionComponent', () => {
  let roles: string[];
  let ediOn: boolean;
  const getTradingPartners = vi.fn();
  const getTransactions = vi.fn();
  const sendOutbound = vi.fn();

  function create(entityType: EdiSendEntityType = 'shipment', customerId: number | null = 42): Internals {
    TestBed.configureTestingModule({
      providers: [
        { provide: EdiService, useValue: { getTradingPartners, getTransactions, sendOutbound } },
        { provide: AuthService, useValue: { hasAnyRole: (r: string[]) => r.some(x => roles.includes(x)) } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-CROSS-INTEG-EDI' && ediOn } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new EdiSendActionComponent());
    mockSignalInputs(component, { entityType, entityId: 5, customerId });
    TestBed.tick();
    return component as unknown as Internals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    roles = ['Manager'];
    ediOn = true;
    getTradingPartners.mockReset().mockReturnValue(of([PARTNER]));
    getTransactions.mockReset().mockReturnValue(of({ data: [txn('Acknowledged', true)], page: 1, pageSize: 1, totalCount: 1, totalPages: 1 }));
    sendOutbound.mockReset().mockReturnValue(of(txn('Processing')));
  });

  it('shows the 856 send for a shipment whose customer has an active partner, with the last status', () => {
    const c = create('shipment');
    expect(c.allowed()).toBe(true);
    expect(getTradingPartners).toHaveBeenCalledWith(true, 42);
    expect(c.partner()).toEqual(PARTNER);
    expect(c.transactionSet()).toBe('856');
    expect(getTransactions).toHaveBeenCalledWith({ transactionSet: '856', relatedEntityType: 'Shipment', relatedEntityId: 5, pageSize: 1 });
    expect(c.outcome()).toBe('acknowledged');
  });

  it('maps the sales order to an 855 and the invoice to an 810', () => {
    expect(create('sales-order').transactionSet()).toBe('855');
    TestBed.resetTestingModule();
    expect(create('invoice').transactionSet()).toBe('810');
    expect(getTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ relatedEntityType: 'Invoice' }));
  });

  it('stays hidden when the customer has no active trading partner', () => {
    getTradingPartners.mockReturnValue(of([]));
    expect(create().partner()).toBeNull();
    expect(getTransactions).not.toHaveBeenCalled();
  });

  it('stays hidden and asks nothing for a role the EDI API refuses', () => {
    roles = ['OfficeManager'];
    const c = create();
    expect(c.allowed()).toBe(false);
    expect(getTradingPartners).not.toHaveBeenCalled();
  });

  it('stays hidden and asks nothing when EDI is off', () => {
    ediOn = false;
    expect(create().allowed()).toBe(false);
    expect(getTradingPartners).not.toHaveBeenCalled();
  });

  it('sends the document to the partner and shows the new status', () => {
    const c = create('invoice');
    c.send();
    expect(sendOutbound).toHaveBeenCalledWith('invoice', 5, 3);
    expect(c.outcome()).toBe('sent');
  });

  it('shows an error outcome for a failed transaction', () => {
    getTransactions.mockReturnValue(of({ data: [txn('Error')], page: 1, pageSize: 1, totalCount: 1, totalPages: 1 }));
    expect(create().outcome()).toBe('error');
  });
});
