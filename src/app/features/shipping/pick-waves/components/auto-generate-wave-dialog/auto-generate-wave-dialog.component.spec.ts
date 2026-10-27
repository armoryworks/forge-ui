import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PickWaveService } from '../../services/pick-wave.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { AutoGenerateWaveDialogComponent } from './auto-generate-wave-dialog.component';

interface Internals {
  form: FormGroup;
  generate(): void;
}

describe('AutoGenerateWaveDialogComponent', () => {
  const autoGenerate = vi.fn(() => of({ id: 9, waveNumber: 'WAVE-0009', totalLines: 3 }));

  beforeEach(() => {
    TestBed.resetTestingModule();
    autoGenerate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: PickWaveService, useValue: { autoGenerate } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  it('generates from lines due by the end of the chosen day, with the strategy and line cap', () => {
    const component = TestBed.runInInjectionContext(() => new AutoGenerateWaveDialogComponent());
    const created = vi.fn();
    component.created.subscribe(created);
    const c = component as unknown as Internals;
    c.form.patchValue({ strategy: 'Discrete', shipBy: new Date(2026, 10, 3), maxLines: 20 });

    c.generate();

    expect(autoGenerate).toHaveBeenCalledWith({
      strategy: 'Discrete',
      shipByDateTo: new Date(2026, 10, 3, 23, 59, 59, 999).toISOString(),
      maxLinesPerWave: 20,
    });
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ waveNumber: 'WAVE-0009' }));
  });

  it('generates without a date limit when no ship-by date is chosen', () => {
    const c = TestBed.runInInjectionContext(() => new AutoGenerateWaveDialogComponent()) as unknown as Internals;
    c.generate();
    expect(autoGenerate).toHaveBeenCalledWith({ strategy: 'Zone', shipByDateTo: null, maxLinesPerWave: 50 });
  });
});
