import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@ngx-translate/core';

import { OfflineQueueService } from '../../services/offline-queue.service';
import { PlatformService } from '../../services/platform.service';
import { OfflineBannerComponent } from './offline-banner.component';

describe('OfflineBannerComponent', () => {
  let online: ReturnType<typeof vi.spyOn>;

  function create(mobileShell: boolean): { message: Signal<string> } {
    TestBed.configureTestingModule({
      providers: [
        { provide: OfflineQueueService, useValue: { pendingCount: signal(0), syncing: signal(false), lastSyncResult: signal(null) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: PlatformService, useValue: { mobileShell } },
      ],
    });
    const banner = TestBed.runInInjectionContext(() => new OfflineBannerComponent());
    return banner as unknown as { message: Signal<string> };
  }

  beforeEach(() => {
    online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  });

  afterEach(() => online.mockRestore());

  it('in the browser, does not promise that changes will sync', () => {
    expect(create(false).message()).toBe('shared.offlineNotSaved');
  });

  it('in the native shell, says changes will sync', () => {
    expect(create(true).message()).toBe('shared.offlineNoChanges');
  });
});
