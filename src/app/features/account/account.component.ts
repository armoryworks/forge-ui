import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../shared/components/input/input.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { AuthService } from '../../shared/services/auth.service';
import { AccountService } from './services/account.service';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#64748b', '#78716c',
];

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, PageLayoutComponent, AvatarComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  private readonly authService = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly user = this.authService.user;
  protected readonly avatarColors = AVATAR_COLORS;
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);

  // Profile form
  protected readonly profileForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    initials: new FormControl('', { nonNullable: true }),
    avatarColor: new FormControl('', { nonNullable: true }),
  });

  // Password form
  protected readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly passwordMismatch = computed(() => {
    const np = this.passwordForm.get('newPassword')?.value;
    const cp = this.passwordForm.get('confirmPassword')?.value;
    return np && cp && np !== cp;
  });

  protected readonly selectedColor = signal('');

  constructor() {
    const u = this.user();
    if (u) {
      this.profileForm.patchValue({
        firstName: u.firstName,
        lastName: u.lastName,
        initials: u.initials ?? '',
        avatarColor: u.avatarColor ?? '',
      });
      this.selectedColor.set(u.avatarColor ?? '');
    }
  }

  protected selectColor(color: string): void {
    this.selectedColor.set(color);
    this.profileForm.patchValue({ avatarColor: color });
  }

  protected saveProfile(): void {
    if (this.profileForm.invalid || this.savingProfile()) return;

    const val = this.profileForm.getRawValue();
    this.savingProfile.set(true);

    this.accountService.updateProfile({
      firstName: val.firstName,
      lastName: val.lastName,
      initials: val.initials || null,
      avatarColor: val.avatarColor || null,
    }).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.authService.refreshUser({
          firstName: val.firstName,
          lastName: val.lastName,
          initials: val.initials || null,
          avatarColor: val.avatarColor || null,
        });
        this.snackbar.success(this.translate.instant('account.profileUpdated'));
      },
      error: () => {
        this.savingProfile.set(false);
      },
    });
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid || this.savingPassword() || this.passwordMismatch()) return;

    const val = this.passwordForm.getRawValue();
    this.savingPassword.set(true);

    this.accountService.changePassword({
      currentPassword: val.currentPassword,
      newPassword: val.newPassword,
    }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.snackbar.success(this.translate.instant('account.passwordChanged'));
      },
      error: () => {
        this.savingPassword.set(false);
      },
    });
  }
}
