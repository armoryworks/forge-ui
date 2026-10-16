import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { FormControl } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { TerminologyPanelComponent } from './terminology-panel.component';
import { AdminService } from '../../services/admin.service';
import { TerminologyService } from '../../../../shared/services/terminology.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { TerminologyEntryItem } from '../../models/terminology-entry-item.model';

interface PanelInternals {
  ngOnInit(): void;
  control(key: string): FormControl<string>;
  dirty: () => boolean;
  otherKeys: () => string[];
  save(): void;
  resetAll(): void;
  enPluralHint(row: unknown): string;
  isMachineTranslated(row: unknown): boolean;
  isUntranslated(row: unknown): boolean;
  rows: { id: string }[];
}

describe('TerminologyPanelComponent', () => {
  let panel: PanelInternals;
  const adminService = {
    getTerminology: vi.fn(),
    updateTerminology: vi.fn(),
  };
  const terminology = { applyEntries: vi.fn() };
  const snackbar = { success: vi.fn(), warn: vi.fn(), errorFrom: vi.fn() };

  const create = (entries: TerminologyEntryItem[]) => {
    adminService.getTerminology.mockReturnValue(of(entries));
    const fixture = TestBed.createComponent(TerminologyPanelComponent);
    panel = fixture.componentInstance as unknown as PanelInternals;
    panel.ngOnInit();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [TerminologyPanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimations(),
        provideTranslateService(),
        { provide: AdminService, useValue: adminService },
        { provide: TerminologyService, useValue: terminology },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
  });

  it('fills the catalog fields from the saved overrides and lists unknown keys separately', () => {
    create([
      { key: 'entity_job', label: 'Work Order' },
      { key: 'status_in_production', label: 'In Progress' },
    ]);

    expect(panel.control('entity_job').value).toBe('Work Order');
    expect(panel.control('label_jobs').value).toBe('');
    expect(panel.otherKeys()).toEqual(['status_in_production']);
    expect(panel.dirty()).toBe(false);
  });

  it('suggests the plural from the typed singular', () => {
    create([]);
    const job = panel.rows.find(r => r.id === 'job')!;

    expect(panel.enPluralHint(job)).toBe('Jobs');
    panel.control('entity_job').setValue('Work Order');
    expect(panel.enPluralHint(job)).toBe('Work Orders');
  });

  it('saves only changed keys, sends cleared keys blank, and applies the result app-wide', () => {
    create([{ key: 'entity_customer', label: 'Patron' }]);
    const saved = [{ key: 'entity_job', label: 'Work Order' }];
    adminService.updateTerminology.mockReturnValue(of({ entries: saved, untranslatedTerms: [] }));

    panel.control('entity_job').setValue(' Work Order ');
    panel.control('entity_customer').setValue('');
    expect(panel.dirty()).toBe(true);
    panel.save();

    expect(adminService.updateTerminology).toHaveBeenCalledWith(
      expect.arrayContaining([
        { key: 'entity_job', label: 'Work Order' },
        { key: 'entity_customer', label: '' },
      ]),
    );
    expect(adminService.updateTerminology.mock.calls[0][0]).toHaveLength(2);
    expect(terminology.applyEntries).toHaveBeenCalledWith(saved);
    expect(snackbar.success).toHaveBeenCalled();
    expect(panel.dirty()).toBe(false);
  });

  it('flags Spanish that was machine-translated until the admin edits it', () => {
    create([
      { key: 'entity_job', label: 'Work Order' },
      { key: 'entity_job:es', label: 'Orden de trabajo', isMachineTranslated: true },
      { key: 'gender_job:es', label: 'f', isMachineTranslated: true },
    ]);
    const job = panel.rows.find(r => r.id === 'job')!;
    const customer = panel.rows.find(r => r.id === 'customer')!;

    expect(panel.isMachineTranslated(job)).toBe(true);
    expect(panel.isMachineTranslated(customer)).toBe(false);

    panel.control('entity_job:es').setValue('Orden de producción');
    panel.control('gender_job:es').setValue('m');
    expect(panel.isMachineTranslated(job)).toBe(false);
  });

  it('warns and marks the term when Spanish could not be translated', () => {
    create([]);
    adminService.updateTerminology.mockReturnValue(of({
      entries: [{ key: 'entity_job', label: 'Work Order' }],
      untranslatedTerms: ['job'],
    }));

    panel.control('entity_job').setValue('Work Order');
    panel.save();

    expect(snackbar.warn).toHaveBeenCalled();
    expect(snackbar.success).not.toHaveBeenCalled();
    expect(panel.isUntranslated(panel.rows.find(r => r.id === 'job')!)).toBe(true);
    expect(panel.isUntranslated(panel.rows.find(r => r.id === 'customer')!)).toBe(false);
  });

  it('clears every rename with reset all', () => {
    create([{ key: 'entity_job', label: 'Work Order' }, { key: 'entity_job:es', label: 'Orden' }]);

    panel.resetAll();

    expect(panel.control('entity_job').value).toBe('');
    expect(panel.control('entity_job:es').value).toBe('');
    expect(panel.dirty()).toBe(true);
  });
});
