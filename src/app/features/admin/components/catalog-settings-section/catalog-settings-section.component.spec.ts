import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AdminSettingsService } from '../../settings/services/admin-settings.service';
import { SettingsCatalogEntry } from '../../settings/models/setting-entry.model';
import { CatalogSettingsSectionComponent } from './catalog-settings-section.component';

function entry(overrides: Partial<SettingsCatalogEntry>): SettingsCatalogEntry {
  return {
    key: 'k', group: 'Payments', displayName: 'K', description: null, dataType: 'String', defaultValue: null,
    isSecret: false, isRequired: false, sortOrder: 0, value: null, hasValue: false, choices: null, ...overrides,
  };
}

type Harness = {
  rows: () => { key: string; kind: string }[];
  form: { controls: Record<string, { setValue(v: unknown): void; markAsDirty(): void; value: unknown }> };
  save(): void;
  ngOnInit(): void;
};

describe('CatalogSettingsSectionComponent', () => {
  let updateSetting: ReturnType<typeof vi.fn>;
  let component: Harness;

  beforeEach(() => {
    updateSetting = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AdminSettingsService,
          useValue: {
            getGroup: () => of([
              entry({ key: 'terms.discount_base', dataType: 'Enum', value: 'Total', choices: [{ value: 'Total', label: 'Total' }, { value: 'Subtotal', label: 'Subtotal' }] }),
              entry({ key: 'terms.discount_grace_days', dataType: 'Integer', value: '0' }),
              entry({ key: 'ar.writeoff_reverses_tax', dataType: 'Boolean', value: 'false' }),
              entry({ key: 'payments.unlisted', dataType: 'String' }),
            ]),
            updateSetting,
          },
        },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new CatalogSettingsSectionComponent()) as unknown as Harness;
  });

  function init(): void {
    Object.defineProperty(component, 'section', {
      value: () => ({
        key: 'payments-credits', group: 'Payments', titleKey: 't', icon: 'payments',
        fields: [
          { key: 'terms.discount_base', labelKey: 'a' },
          { key: 'terms.discount_grace_days', labelKey: 'b' },
          { key: 'ar.writeoff_reverses_tax', labelKey: 'c' },
        ],
      }),
    });
    component.ngOnInit();
  }

  it('renders only the listed fields, each with the editor its data type needs', () => {
    init();

    expect(component.rows().map(r => [r.key, r.kind])).toEqual([
      ['terms.discount_base', 'select'],
      ['terms.discount_grace_days', 'number'],
      ['ar.writeoff_reverses_tax', 'toggle'],
    ]);
  });

  it('saves only the changed fields', () => {
    init();
    const grace = component.form.controls['terms.discount_grace_days'];
    grace.setValue(' 5 ');
    grace.markAsDirty();
    const writeOff = component.form.controls['ar.writeoff_reverses_tax'];
    writeOff.setValue(true);
    writeOff.markAsDirty();

    component.save();

    expect(updateSetting.mock.calls).toEqual([
      ['terms.discount_grace_days', '5'],
      ['ar.writeoff_reverses_tax', 'true'],
    ]);
  });
});
