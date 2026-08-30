import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { InstanceService } from '../../../shared/services/instance.service';
import { LocalLockService } from '../../../shared/services/local-lock.service';
import { PlatformService } from '../../../shared/services/platform.service';
import { PinPadComponent } from './pin-pad.component';

/**
 * The lock screen: biometric first when enabled, PIN pad always. Failure is
 * never silent — a shake, a message, and the remaining-attempts count once
 * the strikes add up. Ten failures wipes this instance.
 */
@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [TranslatePipe, PinPadComponent],
  templateUrl: './lock-screen.component.html',
  styleUrl: './lock-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LockScreenComponent implements OnInit {
  private readonly lock = inject(LocalLockService);
  private readonly platform = inject(PlatformService);
  protected readonly instances = inject(InstanceService);

  protected readonly failures = this.lock.failures;
  protected readonly biometricEnabled = this.lock.biometricEnabled;

  protected readonly attemptsLeft = computed(() => this.lock.maxFailures - this.failures());
  protected readonly showAttemptsLeft = computed(() => this.failures() >= 3);
  protected readonly lastFailed = computed(() => this.failures() > 0);

  ngOnInit(): void {
    void this.lock.tryBiometric();
  }

  protected async onPin(pin: string): Promise<void> {
    const ok = await this.lock.verifyPin(pin);
    if (!ok && this.platform.isNative) {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Error }).catch(() => undefined);
    }
  }

  protected retryBiometric(): void {
    void this.lock.tryBiometric();
  }
}
