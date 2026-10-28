import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';

import { provideTranslateService } from '@ngx-translate/core';

import { Stage } from '../../../../shared/models/stage.model';
import { JobStageSelectComponent } from './job-stage-select.component';

function stage(id: number, sortOrder: number, overrides: Partial<Stage> = {}): Stage {
  return {
    id, name: `S${id}`, code: `s${id}`, sortOrder, color: '#000000', wipLimit: null,
    accountingDocumentType: null, isIrreversible: false, isMandatory: false, ...overrides,
  };
}

interface Internals {
  choices: () => { stage: Stage; disabledReasonKey: string | null }[];
  canOpen: () => boolean;
  select(choice: { stage: Stage; disabledReasonKey: string | null }): void;
}

describe('JobStageSelectComponent', () => {
  let ref: ComponentRef<JobStageSelectComponent>;
  let component: Internals;
  const stages = [
    stage(3, 3, { name: 'Invoiced', accountingDocumentType: 'Invoice' }),
    stage(1, 1, { name: 'Open' }),
    stage(2, 2, { name: 'Build' }),
    stage(4, 4, { name: 'Paid', isIrreversible: true }),
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [JobStageSelectComponent], providers: [provideTranslateService()] });
    TestBed.overrideComponent(JobStageSelectComponent, { set: { template: '' } });
    const fixture = TestBed.createComponent(JobStageSelectComponent);
    ref = fixture.componentRef;
    ref.setInput('jobNumber', 'J-1');
    ref.setInput('stageName', 'Open');
    ref.setInput('stageColor', '#000000');
    ref.setInput('currentStageId', 1);
    ref.setInput('stages', stages);
    component = fixture.componentInstance as unknown as Internals;
  });

  it('lists the track type stages in order and refuses the targets a board drag refuses', () => {
    const reasons = Object.fromEntries(component.choices().map(c => [c.stage.name, c.disabledReasonKey]));

    expect(component.choices().map(c => c.stage.id)).toEqual([1, 2, 3, 4]);
    expect(reasons).toEqual({
      Open: 'jobsTable.stageCurrent',
      Build: null,
      Invoiced: 'kanban.bulkMoveBillingReason',
      Paid: 'jobsTable.stageIrreversible',
    });
  });

  it('lets billing roles into a billing stage', () => {
    ref.setInput('mayBill', true);
    expect(component.choices().find(c => c.stage.id === 3)!.disabledReasonKey).toBeNull();
  });

  it('emits only allowed targets', () => {
    const emitted = vi.fn();
    ref.instance.moveRequested.subscribe(emitted);

    for (const choice of component.choices()) component.select(choice);

    expect(emitted).toHaveBeenCalledOnce();
    expect(emitted.mock.calls[0][0].id).toBe(2);
  });

  it('is read-only for users who cannot move jobs', () => {
    expect(component.canOpen()).toBe(true);
    ref.setInput('readonly', true);
    expect(component.canOpen()).toBe(false);
  });
});
