import { Signal, WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { InstanceService } from '../../../shared/services/instance.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { PickWaveService } from '../../shipping/pick-waves/services/pick-wave.service';
import { PickLine } from '../../shipping/pick-waves/models/pick-line.model';
import { AppPickLinesComponent } from './app-pick-lines.component';

const line = (id: number) => ({ id, waveId: 1, waveNumber: 'WAVE-0001', partNumber: `P-${id}`, requestedQuantity: 2 } as PickLine);

interface Internals {
  lines: Signal<PickLine[]>;
  failed: Signal<boolean>;
  needsIdentity: Signal<boolean>;
  confirming: WritableSignal<PickLine | null>;
  onConfirmed(): void;
}

describe('AppPickLinesComponent', () => {
  let shared: boolean;
  const identified = signal(false);
  const getMyLines = vi.fn();

  function create(): Internals {
    const component = TestBed.runInInjectionContext(() => new AppPickLinesComponent());
    TestBed.tick();
    return component as unknown as Internals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    shared = false;
    identified.set(false);
    getMyLines.mockReset().mockReturnValue(of([line(1), line(2)]));
    TestBed.configureTestingModule({
      providers: [
        { provide: PickWaveService, useValue: { getMyLines } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared }) } },
        { provide: SharedIdentityService, useValue: { identified } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  it('loads the caller\'s open pick lines', () => {
    const c = create();
    expect(getMyLines).toHaveBeenCalledOnce();
    expect(c.lines().map(l => l.id)).toEqual([1, 2]);
  });

  it('on a shared device waits for the person to identify', () => {
    shared = true;
    const c = create();
    expect(c.needsIdentity()).toBe(true);
    expect(getMyLines).not.toHaveBeenCalled();

    identified.set(true);
    TestBed.tick();
    expect(getMyLines).toHaveBeenCalledOnce();
  });

  it('reloads after a line is confirmed', () => {
    const c = create();
    c.confirming.set(line(1));
    c.onConfirmed();
    expect(c.confirming()).toBeNull();
    expect(getMyLines).toHaveBeenCalledTimes(2);
  });

  it('says so when the lines cannot load', () => {
    getMyLines.mockReturnValue(throwError(() => new Error('down')));
    expect(create().failed()).toBe(true);
  });
});
