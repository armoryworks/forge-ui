import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';


import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LanguageToggleComponent } from '../../../shared/components/language-toggle/language-toggle.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { CapabilityDisabledError } from '../../../shared/errors/capability-disabled.error';
import { MobileDevice } from '../../../shared/models/mobile-device.model';
import { AppInfoService } from '../../../shared/services/app-info.service';
import { AuthService } from '../../../shared/services/auth.service';
import { CapabilityService } from '../../../shared/services/capability.service';
import { CrashReportingService } from '../../../shared/services/crash-reporting.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { LocalLockService } from '../../../shared/services/local-lock.service';
import { MobileAuthService } from '../../../shared/services/mobile-auth.service';
import { MobileDevicesService } from '../../../shared/services/mobile-devices.service';
import { PlatformService } from '../../../shared/services/platform.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { MOBILE_APP_SCREENS } from '../../../shared/utils/mobile-app-screens';
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';

const PROBLEM_MAX_LENGTH = 2000;

/**
 * Account: who is signed in, the instances on this phone (switch / add /
 * remove), this person's devices, the lock and diagnostics toggles,
 * language, report-a-problem, sign-out, and the app build. Never a tab.
 * In a browser the instances and the lock are not offered, since only the
 * native shell has them; signing out there ends the web session, and on the
 * phone it signs this device out and removes the server from it. When no
 * phone screen is turned on for the shop it says so, since this is where
 * the screen guard sends the person. The biometric switch shows only when
 * the device can unlock that way.
 */
@Component({
  selector: 'app-app-account',
  standalone: true,
  imports: [ReactiveFormsModule, DateTimePipe, TranslatePipe, LanguageToggleComponent, TextareaComponent],
  templateUrl: './app-account.component.html',
  styleUrl: './app-account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppAccountComponent {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthService);
  private readonly mobileAuth = inject(MobileAuthService);
  private readonly devices = inject(MobileDevicesService);
  private readonly capabilities = inject(CapabilityService);
  protected readonly instances = inject(InstanceService);
  protected readonly lock = inject(LocalLockService);
  protected readonly crash = inject(CrashReportingService);
  protected readonly platform = inject(PlatformService);
  protected readonly appInfo = inject(AppInfoService);

  protected readonly user = this.auth.user;
  protected readonly active = this.instances.instance;
  protected readonly shared = computed(() => !!this.active()?.shared);
  protected readonly noScreens = computed(() =>
    !MOBILE_APP_SCREENS.some((screen) => this.capabilities.isEnabled(screen.capability, true)));
  protected readonly myDevices = signal<MobileDevice[]>([]);
  protected readonly devicesProblem = signal<'forbidden' | 'failed' | null>(null);
  protected readonly busy = signal(false);
  protected readonly pendingRemoval = signal<string | null>(null);
  protected readonly pendingRevoke = signal<number | null>(null);
  protected readonly sent = signal(false);

  protected readonly problemMaxLength = PROBLEM_MAX_LENGTH;
  protected readonly problemControl = new FormControl('', {
    nonNullable: true, validators: [Validators.required, Validators.maxLength(PROBLEM_MAX_LENGTH)],
  });
  private readonly problemText = toSignal(this.problemControl.valueChanges, { initialValue: '' });
  protected readonly problemCount = computed(() =>
    this.translate.instant('mobileApp.account.problemCount', { count: this.problemText().length, max: PROBLEM_MAX_LENGTH }));
  protected readonly confirmingSignOut = signal(false);
  protected readonly biometricAvailable = signal(false);

  constructor() {
    void this.lock.biometricAvailable().then((available) => this.biometricAvailable.set(available), () => undefined);
    if (!this.shared()) {
      this.devices.mine().subscribe({
        next: (list) => this.myDevices.set(list.filter((d) => d.revokedAt === null)),
        error: (err: unknown) => {
          this.myDevices.set([]);
          this.devicesProblem.set(
            err instanceof CapabilityDisabledError || (err instanceof HttpErrorResponse && err.status === 403)
              ? 'forbidden'
              : 'failed');
        },
      });
    }
  }

  protected isCurrentDevice(device: MobileDevice): boolean {
    return device.id === this.active()?.deviceId;
  }

  protected async switchTo(id: string): Promise<void> {
    if (id === this.active()?.id || this.busy()) return;
    this.busy.set(true);
    try {
      const ok = await this.mobileAuth.switchInstance(id);
      if (ok) await this.router.navigateByUrl('/app');
      else this.snackbar.error(this.translate.instant('mobileApp.account.switchFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    if (!this.confirmingSignOut()) {
      this.confirmingSignOut.set(true);
      return;
    }
    this.confirmingSignOut.set(false);
    if (!this.platform.mobileShell) {
      if (await this.auth.logout()) await this.router.navigate(['/login']);
      return;
    }
    const current = this.myDevices().find((device) => this.isCurrentDevice(device));
    if (current) await firstValueFrom(this.devices.revoke(current.id)).catch(() => undefined);
    const active = this.active();
    if (active) await this.remove(active.id);
  }

  protected addInstance(): void {
    void this.router.navigate(['/app/enroll']);
  }

  protected askRemove(id: string): void {
    this.pendingRemoval.set(this.pendingRemoval() === id ? null : id);
  }

  protected async remove(id: string): Promise<void> {
    this.pendingRemoval.set(null);
    const wasActive = id === this.active()?.id;
    await this.instances.remove(id);
    if (!wasActive) return;
    const next = this.instances.instances()[0];
    if (next) await this.switchTo(next.id);
    else await this.mobileAuth.wipeAndRestart();
  }

  protected askRevoke(id: number): void {
    this.pendingRevoke.set(this.pendingRevoke() === id ? null : id);
  }

  protected async revoke(device: MobileDevice): Promise<void> {
    this.pendingRevoke.set(null);
    await firstValueFrom(this.devices.revoke(device.id));
    if (this.isCurrentDevice(device)) {
      const active = this.active();
      if (active) await this.remove(active.id);
      return;
    }
    this.myDevices.update((list) => list.filter((d) => d.id !== device.id));
  }

  protected changePin(): void {
    this.lock.rememberReturnUrl('/app/account');
    void this.router.navigate(['/app/setup-lock']);
  }

  protected async toggleBiometric(): Promise<void> {
    await this.lock.setBiometricEnabled(!this.lock.biometricEnabled());
  }

  protected async toggleDiagnostics(): Promise<void> {
    await this.crash.setEnabled(!this.crash.enabled());
  }

  protected async sendProblem(): Promise<void> {
    if (this.problemControl.invalid || this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.devices.reportProblem({
        message: this.problemControl.value.trim(),
        screen: null,
        appVersion: this.appInfo.version(),
        platform: this.platform.name,
      }));
      this.problemControl.reset();
      this.sent.set(true);
      this.snackbar.success(this.translate.instant('mobileApp.account.problemSent'));
    } catch {
      this.snackbar.error(this.translate.instant('mobileApp.account.problemFailed'));
    } finally {
      this.busy.set(false);
    }
  }
}
