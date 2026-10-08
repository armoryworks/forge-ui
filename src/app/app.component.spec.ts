import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { SwUpdate } from '@angular/service-worker';
import { EMPTY } from 'rxjs';

import { AppComponent } from './app.component';
import { AccountingService } from './shared/services/accounting.service';
import { CapabilityService } from './shared/services/capability.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatDialog, useValue: { open: vi.fn() } },
        // AppUpdateService (used by AppComponent) injects SwUpdate; the SW is
        // disabled in tests, so a no-op stub satisfies the DI graph.
        { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: EMPTY } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  describe('accounting mode', () => {
    function loadGatedState(externalAccounting: boolean): ReturnType<typeof vi.spyOn> {
      const fixture = TestBed.createComponent(AppComponent);
      const capabilities = TestBed.inject(CapabilityService);
      vi.spyOn(capabilities, 'isEnabled').mockImplementation(code => code === 'CAP-ACCT-EXTERNAL' && externalAccounting);
      const load = vi.spyOn(TestBed.inject(AccountingService), 'load').mockImplementation(() => undefined);
      (fixture.componentInstance as unknown as { loadCapabilityGatedState(): void }).loadCapabilityGatedState();
      return load;
    }

    it('skips the accounting-mode request when external accounting is off', () => {
      expect(loadGatedState(false)).not.toHaveBeenCalled();
    });

    it('loads the accounting mode when external accounting is on', () => {
      expect(loadGatedState(true)).toHaveBeenCalledTimes(1);
    });
  });
});
