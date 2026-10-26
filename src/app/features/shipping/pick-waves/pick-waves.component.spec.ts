import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';

import { PickWaveService } from './services/pick-wave.service';
import { PickWave } from './models/pick-wave.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { PickWavesComponent } from './pick-waves.component';
import { ROUTE_ACCESS } from '../../../shared/models/route-access.model';

const wave = (id: number, status: PickWave['status']) => ({ id, waveNumber: `WAVE-${id}`, status, totalLines: 2, pickedLines: 0 } as PickWave);

interface Internals {
  filteredWaves: Signal<PickWave[]>;
  selectedId: Signal<number | null>;
  statusControl: FormControl;
  openWave(w: PickWave): void;
  onGenerated(w: PickWave): void;
}

describe('PickWavesComponent', () => {
  const getWaves = vi.fn();
  const navigate = vi.fn();
  const params = new BehaviorSubject(convertToParamMap({}));

  function create(): Internals {
    return TestBed.runInInjectionContext(() => new PickWavesComponent()) as unknown as Internals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    getWaves.mockReset().mockReturnValue(of([wave(1, 'Draft'), wave(2, 'Released'), wave(3, 'Completed')]));
    navigate.mockClear();
    params.next(convertToParamMap({}));
    TestBed.configureTestingModule({
      providers: [
        { provide: PickWaveService, useValue: { getWaves } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        { provide: Router, useValue: { navigate } },
        { provide: SnackbarService, useValue: { errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  it('lists the waves and filters them by status', () => {
    const c = create();
    expect(getWaves).toHaveBeenCalled();
    expect(c.filteredWaves().length).toBe(3);
    c.statusControl.setValue('Released');
    expect(c.filteredWaves().map(w => w.id)).toEqual([2]);
  });

  it('keeps the open wave in the URL', () => {
    const c = create();
    c.openWave(wave(2, 'Released'));
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { wave: 2 } }));
    params.next(convertToParamMap({ wave: '2' }));
    expect(c.selectedId()).toBe(2);
  });

  it('reloads and opens a newly generated wave', () => {
    const c = create();
    c.onGenerated(wave(9, 'Draft'));
    expect(getWaves).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { wave: 9 } }));
  });

  it('is gated to the picking roles behind the pick/pack capability, not to project managers', () => {
    expect(ROUTE_ACCESS['pick-waves'].capabilities).toEqual(['CAP-O2C-PICKPACK']);
    expect(ROUTE_ACCESS['pick-waves'].roles).toEqual(['Admin', 'Manager', 'OfficeManager', 'Engineer', 'ProductionWorker']);
    expect(ROUTE_ACCESS['pick-waves'].roles).not.toContain('PM');
  });
});
