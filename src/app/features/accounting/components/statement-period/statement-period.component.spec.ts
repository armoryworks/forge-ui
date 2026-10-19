import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

import { StatementPeriodComponent } from './statement-period.component';
import { StatementPeriod } from '../../utils/statement-period';

type Internals = {
  presetControl: FormControl<string>;
  fromControl: FormControl<Date | null>;
  toControl: FormControl<Date | null>;
  periodChange: { subscribe(fn: (p: StatementPeriod) => void): unknown };
};

describe('StatementPeriodComponent', () => {
  function create(): { c: Internals; emitted: StatementPeriod[] } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    TestBed.overrideComponent(StatementPeriodComponent, { set: { template: '', imports: [], styles: [] } });
    const c = TestBed.createComponent(StatementPeriodComponent).componentInstance as unknown as Internals;
    const emitted: StatementPeriod[] = [];
    c.periodChange.subscribe((p) => emitted.push(p));
    return { c, emitted };
  }

  it('emits the window a range preset stands for', () => {
    const { c, emitted } = create();
    c.presetControl.setValue('yearToDate');
    expect(emitted).toHaveLength(1);
    expect(emitted[0].from).toBeNull();
    expect(emitted[0].to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('emits typed dates as a custom window, and ignores a start after the end', () => {
    const { c, emitted } = create();
    c.fromControl.setValue(new Date(2026, 0, 1));
    c.toControl.setValue(new Date(2026, 2, 31));
    expect(emitted.at(-1)).toEqual({ from: '2026-01-01', to: '2026-03-31' });

    c.fromControl.setValue(new Date(2026, 5, 1));
    expect(emitted.at(-1)).toEqual({ from: '2026-01-01', to: '2026-03-31' });
  });

  it('does not emit for the custom preset alone', () => {
    const { c, emitted } = create();
    c.presetControl.setValue('custom');
    expect(emitted).toHaveLength(0);
  });
});
