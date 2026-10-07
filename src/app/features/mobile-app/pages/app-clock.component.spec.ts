import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../shared/services/auth.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { AppClockComponent } from './app-clock.component';

interface ClockInternals {
  doPunch(kind: 'ClockIn'): Promise<void>;
}

describe('AppClockComponent', () => {
  let shared: boolean;
  let token: string | null;
  const offer = vi.fn();
  const clear = vi.fn(() => { token = null; });
  const api = {
    clockState: vi.fn(),
    clockPunch: vi.fn(),
    undoClockPunch: vi.fn(),
  };
  const state = { state: 'in' as const, lastEventType: 'ClockIn', lastEventAt: null, lastEventId: 5 };

  beforeEach(() => {
    shared = true;
    token = 'person-token';
    offer.mockReset();
    clear.mockClear();
    api.clockState.mockReset().mockReturnValue(of(state));
    api.clockPunch.mockReset().mockReturnValue(of({ eventId: 5, state }));
    api.undoClockPunch.mockReset().mockReturnValue(of({ ...state, state: 'out' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: MobileApiService, useValue: api },
        { provide: UndoService, useValue: { offer } },
        { provide: OfflineQueueService, useValue: { remove: vi.fn() } },
        { provide: SnackbarService, useValue: { error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SharedIdentityService, useValue: { identified: signal(true), person: signal(null), clear } },
        { provide: AuthService, useValue: { token: () => token } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared }) } },
      ],
    });
  });

  it('on a shared device, undoes the punch with the token captured before the identity cleared', async () => {
    const clock = TestBed.runInInjectionContext(() => new AppClockComponent()) as unknown as ClockInternals;

    await clock.doPunch('ClockIn');
    expect(clear).toHaveBeenCalledOnce();

    const [, compensate] = offer.mock.calls[0];
    await compensate();
    expect(api.undoClockPunch).toHaveBeenCalledWith(5, 'person-token');
  });

  it('on a personal device, undoes through the normal session', async () => {
    shared = false;
    const clock = TestBed.runInInjectionContext(() => new AppClockComponent()) as unknown as ClockInternals;

    await clock.doPunch('ClockIn');
    const [, compensate] = offer.mock.calls[0];
    await compensate();

    expect(clear).not.toHaveBeenCalled();
    expect(api.undoClockPunch).toHaveBeenCalledWith(5, undefined);
  });
});
