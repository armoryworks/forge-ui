import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';

import { mockSignalInputs } from '../../../../testing/signal-input-harness';
import { PaymentProgressComponent } from './payment-progress.component';
import { PaymentMilestone } from '../../models/payment-milestone.model';
import { PaymentSchedule } from '../../models/payment-schedule.model';

interface MilestoneViewShape {
  id: number;
  name: string;
  percentage: number;
  amountDue: number;
  chipClass: string;
  statusKey: string;
  waived: boolean;
}

interface Setup {
  component: PaymentProgressComponent;
  schedule: WritableSignal<PaymentSchedule>;
  paidPct(): number;
  remainingPct(): number;
  views(): MilestoneViewShape[];
}

function milestone(overrides: Partial<PaymentMilestone> = {}): PaymentMilestone {
  return {
    id: 1,
    sequence: 1,
    name: 'Deposit',
    percentage: 30,
    dueTrigger: 'OnAcceptance',
    dueDate: null,
    netDays: null,
    status: 'Pending',
    amountDue: 300,
    paidAmount: 0,
    invoiceId: null,
    notes: null,
    ...overrides,
  };
}

function scheduleOf(
  milestones: PaymentMilestone[],
  totals: { documentTotal: number; paidTotal: number; remainingTotal: number },
): PaymentSchedule {
  return { id: 1, quoteId: 5, salesOrderId: null, status: 'Active', milestones, totals };
}

function setup(initial: PaymentSchedule): Setup {
  TestBed.configureTestingModule({});
  const component = TestBed.runInInjectionContext(() => new PaymentProgressComponent());
  const inputs = mockSignalInputs(component, { schedule: initial });
  // Read the protected computeds by name — equivalent verification because
  // the template bindings are single computed reads (same approach as the
  // CurrencyDisplayComponent spec).
  const c = component as unknown as {
    paidPct: () => number;
    remainingPct: () => number;
    milestoneViews: () => MilestoneViewShape[];
  };
  return {
    component,
    schedule: inputs.schedule,
    paidPct: () => c.paidPct(),
    remainingPct: () => c.remainingPct(),
    views: () => c.milestoneViews(),
  };
}

describe('PaymentProgressComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  // ── Segment math ───────────────────────────────────────────────────────────

  it('computes proportional paid/remaining segments from the totals', () => {
    const { paidPct, remainingPct } = setup(
      scheduleOf([milestone()], { documentTotal: 1000, paidTotal: 250, remainingTotal: 750 }),
    );
    expect(paidPct()).toBe(25);
    expect(remainingPct()).toBe(75);
  });

  it('renders an all-remaining bar when nothing is paid', () => {
    const { paidPct, remainingPct } = setup(
      scheduleOf([milestone()], { documentTotal: 500, paidTotal: 0, remainingTotal: 500 }),
    );
    expect(paidPct()).toBe(0);
    expect(remainingPct()).toBe(100);
  });

  it('treats a zero document total as 0% paid instead of dividing by zero', () => {
    const { paidPct, remainingPct } = setup(
      scheduleOf([milestone()], { documentTotal: 0, paidTotal: 0, remainingTotal: 0 }),
    );
    expect(paidPct()).toBe(0);
    expect(remainingPct()).toBe(100);
  });

  it('clamps overpayment to a full bar', () => {
    const { paidPct, remainingPct } = setup(
      scheduleOf([milestone()], { documentTotal: 100, paidTotal: 150, remainingTotal: 0 }),
    );
    expect(paidPct()).toBe(100);
    expect(remainingPct()).toBe(0);
  });

  it('recomputes when the schedule input changes', () => {
    const { schedule, paidPct } = setup(
      scheduleOf([milestone()], { documentTotal: 1000, paidTotal: 250, remainingTotal: 750 }),
    );
    schedule.set(scheduleOf([milestone()], { documentTotal: 1000, paidTotal: 500, remainingTotal: 500 }));
    expect(paidPct()).toBe(50);
  });

  // ── Status chip classes ────────────────────────────────────────────────────

  it.each([
    ['Pending', 'chip chip--muted'],
    ['Due', 'chip chip--warning'],
    ['Invoiced', 'chip chip--info'],
    ['PartiallyPaid', 'chip chip--warning'],
    ['Paid', 'chip chip--success'],
    ['Waived', 'chip chip--muted'],
  ])('maps status %s to "%s"', (status, expectedClass) => {
    const { views } = setup(
      scheduleOf([milestone({ status })], { documentTotal: 1000, paidTotal: 0, remainingTotal: 1000 }),
    );
    expect(views()[0].chipClass).toBe(expectedClass);
    expect(views()[0].statusKey).toBe('shared.paymentProgress.status' + status);
  });

  it('falls back to the muted chip for an unknown status', () => {
    const { views } = setup(
      scheduleOf([milestone({ status: 'SomethingNew' })], { documentTotal: 1000, paidTotal: 0, remainingTotal: 1000 }),
    );
    expect(views()[0].chipClass).toBe('chip chip--muted');
  });

  it('flags only waived milestones for strikethrough styling', () => {
    const { views } = setup(
      scheduleOf(
        [milestone({ id: 1, status: 'Waived' }), milestone({ id: 2, status: 'Paid' })],
        { documentTotal: 1000, paidTotal: 300, remainingTotal: 700 },
      ),
    );
    expect(views().map(v => v.waived)).toEqual([true, false]);
  });
});
