import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { WebhooksService } from '../services/webhooks.service';
import { WebhookDelivery, WebhookSubscription } from '../models/webhook.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { WebhooksComponent } from './webhooks.component';

const SUB: WebhookSubscription = {
  id: 4, url: 'https://erp.example.test/hooks', eventTypesJson: '["invoice.created","job.created"]', isActive: true,
  failureCount: 0, maxRetries: 5, lastDeliveredAt: null, lastFailedAt: null, autoDisableOnFailure: true,
  description: 'ERP bridge', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', headersJson: null, secret: null,
};

const DELIVERY: WebhookDelivery = {
  id: 90, subscriptionId: 4, eventType: 'invoice.created', statusCode: 500, durationMs: 120,
  attemptedAt: '2026-10-27T09:00:00Z', attemptNumber: 1, isSuccess: false, errorMessage: 'Webhook returned 500.', responseBody: 'boom',
};

interface Internals {
  form: FormGroup;
  subscriptions(): WebhookSubscription[];
  eventOptions(): { value: unknown }[];
  revealedSecret(): string | null;
  showEditor(): boolean;
  deliveries(): WebhookDelivery[];
  openCreate(): void;
  openEdit(row: WebhookSubscription): void;
  save(): void;
  test(row: WebhookSubscription): void;
  openDeliveries(row: WebhookSubscription): void;
  redeliver(row: WebhookDelivery): void;
  events(row: WebhookSubscription): string[];
  statusKey(row: WebhookSubscription): string;
}

function setup() {
  const service = {
    list: vi.fn(() => of([SUB])),
    eventTypes: vi.fn(() => of(['invoice.created', 'job.created'])),
    create: vi.fn(() => of({ ...SUB, id: 5, secret: 'whsec_abc' })),
    update: vi.fn(() => of(SUB)),
    delete: vi.fn(() => of(undefined)),
    test: vi.fn(() => of({ ...DELIVERY, id: 91, isSuccess: true, statusCode: 200 })),
    deliveries: vi.fn(() => of([DELIVERY])),
    redeliver: vi.fn(() => of({ ...DELIVERY, id: 92, isSuccess: true, statusCode: 200 })),
  };
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: WebhooksService, useValue: service },
      { provide: SnackbarService, useValue: snackbar },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new WebhooksComponent()) as unknown as Internals;
  return { component, service, snackbar };
}

describe('WebhooksComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads subscriptions and the event catalog', () => {
    const { component, service } = setup();

    expect(service.list).toHaveBeenCalled();
    expect(component.subscriptions()).toEqual([SUB]);
    expect(component.eventOptions().map(o => o.value)).toEqual(['invoice.created', 'job.created']);
    expect(component.events(SUB)).toEqual(['invoice.created', 'job.created']);
    expect(component.statusKey({ ...SUB, failureCount: 2 })).toBe('webhooksAdmin.statusFailing');
    expect(component.statusKey({ ...SUB, isActive: false })).toBe('webhooksAdmin.statusInactive');
  });

  it('creates a subscription and shows the generated secret once', () => {
    const { component, service } = setup();

    component.openCreate();
    component.form.patchValue({ url: 'https://hooks.example.test/in', eventTypes: ['job.created'] });
    component.save();

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://hooks.example.test/in', eventTypesJson: '["job.created"]', secret: null,
    }));
    expect(component.revealedSecret()).toBe('whsec_abc');
    expect(component.showEditor()).toBe(false);
  });

  it('requires at least one event unless all events are chosen', () => {
    const { component } = setup();

    component.openCreate();
    component.form.patchValue({ url: 'https://hooks.example.test/in' });
    expect(component.form.hasError('events')).toBe(true);
    component.form.patchValue({ allEvents: true });
    expect(component.form.valid).toBe(true);
  });

  it('rejects headers that are not a JSON object of strings', () => {
    const { component } = setup();

    component.openCreate();
    component.form.patchValue({ url: 'https://h.example.test', allEvents: true, headersJson: '["x"]' });
    expect(component.form.controls['headersJson'].hasError('headers')).toBe(true);
    component.form.patchValue({ headersJson: '{"X-Tenant":"plant-1"}' });
    expect(component.form.valid).toBe(true);
  });

  it('edits with PUT, keeping the event list and all-events flag', () => {
    const { component, service } = setup();

    component.openEdit(SUB);
    component.form.patchValue({ allEvents: true, isActive: false, rotateSecret: true });
    component.save();

    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).toHaveBeenCalledWith(4, expect.objectContaining({
      eventTypesJson: '["*"]', isActive: false, rotateSecret: true, description: 'ERP bridge',
    }));
  });

  it('sends a test ping and reports the result', () => {
    const { component, service, snackbar } = setup();

    component.test(SUB);

    expect(service.test).toHaveBeenCalledWith(4);
    expect(snackbar.success).toHaveBeenCalledWith('webhooksAdmin.testSucceeded');
  });

  it('shows the delivery log and redelivers a failed delivery', () => {
    const { component, service } = setup();

    component.openDeliveries(SUB);
    expect(service.deliveries).toHaveBeenCalledWith(4);
    expect(component.deliveries()).toEqual([DELIVERY]);

    component.redeliver(DELIVERY);
    expect(service.redeliver).toHaveBeenCalledWith(90);
    expect(service.deliveries).toHaveBeenCalledTimes(2);
  });
});
