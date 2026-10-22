import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { OperationQuantityDialogComponent } from './operation-quantity-dialog.component';
import { OperationGate } from '../../models/operation-gate.model';
import { OperationQuantityDialogData } from '../../models/operation-quantity-dialog-data.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface GateInternals {
  form: { value: { quantity?: number | null } } & { patchValue(value: { quantity?: number | null; scrap?: number | null; gateAck?: boolean; gateReason?: string | null }): void };
  gateShown: () => boolean;
  recordGated: () => boolean;
  doneGated: () => boolean;
  canRecord: () => boolean;
  canComplete: () => boolean;
  doneViolations: () => string[];
  record(): void;
  complete(): void;
}

function setup(gate: OperationGate | null, overrides: Partial<OperationQuantityDialogData> = {}) {
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      {
        provide: MAT_DIALOG_DATA,
        useValue: { title: 'Mill', jobQuantity: 20, completedQuantity: 2, scrapQuantity: 0, reasons: [], mode: 'stop', gate, ...overrides },
      },
      { provide: MatDialogRef, useValue: { close } },
      { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(true) })) } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new OperationQuantityDialogComponent()) as unknown as GateInternals;
  return { component, close };
}

const warn: OperationGate = { mode: 'Warn', available: 5, availableFromStep: 10, waitingOnSteps: [], canOverride: true };

describe('OperationQuantityDialogComponent step gate', () => {
  it('shows nothing while the count stays within what the predecessor finished', () => {
    const { component, close } = setup(warn);

    component.form.patchValue({ quantity: 3 });
    expect(component.gateShown()).toBe(false);
    component.record();

    expect(close).toHaveBeenCalledWith(expect.not.objectContaining({ acknowledgeGate: true }));
  });

  it('asks for confirmation in Warn mode and sends the acknowledgement with the reason', () => {
    const { component, close } = setup(warn);

    component.form.patchValue({ quantity: 4 });
    expect(component.recordGated()).toBe(true);
    expect(component.canRecord()).toBe(false);
    component.record();
    expect(close).not.toHaveBeenCalled();

    component.form.patchValue({ gateAck: true, gateReason: ' saw count still open ' });
    expect(component.canRecord()).toBe(true);
    component.record();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({
      completedQuantity: 6, acknowledgeGate: true, overrideReason: 'saw count still open',
    }));
  });

  it('refuses in Block mode for someone who may not override', () => {
    const { component, close } = setup({ ...warn, mode: 'Block', canOverride: false });

    component.form.patchValue({ quantity: 4, gateAck: true, gateReason: 'please' });
    expect(component.canRecord()).toBe(false);
    expect(component.canComplete()).toBe(false);
    expect(component.doneViolations()).toContain('jobOperations.gate.askSupervisor');
    component.record();
    component.complete();

    expect(close).not.toHaveBeenCalled();
  });

  it('needs a reason before a supervisor can override a Block', () => {
    const { component, close } = setup({ ...warn, mode: 'Block', canOverride: true });

    component.form.patchValue({ quantity: 4, gateAck: true });
    expect(component.canRecord()).toBe(false);

    component.form.patchValue({ gateReason: 'parts from stock' });
    component.record();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ acknowledgeGate: true, overrideReason: 'parts from stock' }));
  });

  it('holds Done until a Complete-gated predecessor is done, without blocking a plain record', () => {
    const { component, close } = setup({ ...warn, available: null, availableFromStep: null, waitingOnSteps: [20] });

    component.form.patchValue({ quantity: 3 });
    expect(component.recordGated()).toBe(false);
    expect(component.doneGated()).toBe(true);
    expect(component.canComplete()).toBe(false);
    expect(component.canRecord()).toBe(true);

    component.form.patchValue({ gateAck: true });
    component.complete();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ complete: true, acknowledgeGate: true, overrideReason: null }));
  });

  it('counts the Done fallback against the available pieces', () => {
    const { component } = setup(warn);

    expect(component.recordGated()).toBe(false);
    expect(component.doneGated()).toBe(true);
  });

  it('starts a record at what the gate leaves room for, not the whole remaining quantity', () => {
    const { component } = setup(warn, { mode: 'record' });

    expect(component.form.value.quantity).toBe(3);
    expect(component.gateShown()).toBe(false);
  });

  it('starts a record at the count it was given', () => {
    const { component } = setup(warn, { mode: 'record', initialQuantity: 4 });

    expect(component.form.value.quantity).toBe(4);
    expect(component.recordGated()).toBe(true);
  });
});
