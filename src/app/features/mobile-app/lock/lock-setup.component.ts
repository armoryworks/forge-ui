import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { LocalLockService } from '../../../shared/services/local-lock.service';
import { PinPadComponent } from './pin-pad.component';

type SetupStage = 'create' | 'confirm' | 'biometric';

/**
 * Post-enrollment lock setup: create a 6-digit PIN, confirm it, then offer
 * biometric unlock when the hardware supports it. Lands on Scan when done.
 */
@Component({
  selector: 'app-lock-setup',
  standalone: true,
  imports: [TranslatePipe, PinPadComponent],
  templateUrl: './lock-setup.component.html',
  styleUrl: './lock-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LockSetupComponent implements OnInit {
  private readonly lock = inject(LocalLockService);
  private readonly router = inject(Router);

  protected readonly stage = signal<SetupStage>('create');
  protected readonly mismatch = signal(false);
  protected readonly biometricAvailable = signal(false);

  private firstEntry: string | null = null;

  async ngOnInit(): Promise<void> {
    this.biometricAvailable.set(await this.lock.biometricAvailable());
  }

  protected async onPin(pin: string): Promise<void> {
    if (this.stage() === 'create') {
      this.firstEntry = pin;
      this.mismatch.set(false);
      this.stage.set('confirm');
      return;
    }

    if (pin !== this.firstEntry) {
      this.firstEntry = null;
      this.mismatch.set(true);
      this.stage.set('create');
      return;
    }

    await this.lock.setPin(pin);
    if (this.biometricAvailable()) {
      this.stage.set('biometric');
      return;
    }
    await this.finish(false);
  }

  protected async finish(enableBiometric: boolean): Promise<void> {
    await this.lock.setBiometricEnabled(enableBiometric);
    await this.router.navigateByUrl(this.lock.takeReturnUrl());
  }
}
