import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { CONFIRM_BEFORE_SEND_PREF_KEY } from '../../../../shared/services/confirm-send.service';
import { FontScale, ThemeService } from '../../../../shared/services/theme.service';
import { UserPreferencesService } from '../../../../shared/services/user-preferences.service';
import { IdleService } from '../../../../shared/services/idle.service';
import { ChatNotificationService, ChatSoundType } from '../../../../shared/services/chat-notification.service';
import { DRAFT_TTL_OPTIONS, DEFAULT_DRAFT_TTL, DraftTtlOption } from '../../../../shared/models/draft-ttl.model';
import {
  AMBIENT_IDLE_OPTIONS,
  AMBIENT_IDLE_PREF_KEY,
  AmbientIdleOption,
  DEFAULT_AMBIENT_IDLE_MS,
} from '../../../../shared/models/ambient-idle.model';

const DRAFT_TTL_PREF_KEY = 'draft:ttlMs';

@Component({
  selector: 'app-account-customization',
  standalone: true,
  imports: [TranslatePipe, ReactiveFormsModule, ToggleComponent],
  templateUrl: './account-customization.component.html',
  styleUrl: './account-customization.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountCustomizationComponent {
  private readonly themeService = inject(ThemeService);
  private readonly preferences = inject(UserPreferencesService);
  private readonly idleService = inject(IdleService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly chatNotification = inject(ChatNotificationService);

  /** Confirm-before-send safety prompt — ON by default when never set. */
  protected readonly confirmBeforeSendControl = new FormControl<boolean>(
    this.preferences.get<boolean>(CONFIRM_BEFORE_SEND_PREF_KEY) ?? true,
    { nonNullable: true },
  );

  constructor() {
    this.confirmBeforeSendControl.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(enabled => {
      this.preferences.set(CONFIRM_BEFORE_SEND_PREF_KEY, enabled);
    });
  }

  protected readonly theme = this.themeService.theme;
  protected readonly fontScale = this.themeService.fontScale;

  protected readonly fontScaleOptions: { value: FontScale; labelKey: string; hint: string }[] = [
    { value: 'default',     labelKey: 'account.fontScaleDefault',     hint: '12px' },
    { value: 'comfortable', labelKey: 'account.fontScaleComfortable',  hint: '14px' },
    { value: 'large',       labelKey: 'account.fontScaleLarge',        hint: '16px' },
    { value: 'xl',          labelKey: 'account.fontScaleXl',           hint: '18px' },
  ];

  protected readonly draftTtlOptions: DraftTtlOption[] = DRAFT_TTL_OPTIONS;
  protected readonly draftTtl = signal(
    this.preferences.get<number>(DRAFT_TTL_PREF_KEY) ?? DEFAULT_DRAFT_TTL,
  );

  protected readonly ambientIdleOptions: AmbientIdleOption[] = AMBIENT_IDLE_OPTIONS;
  protected readonly ambientIdle = signal(
    this.preferences.get<number>(AMBIENT_IDLE_PREF_KEY) ?? DEFAULT_AMBIENT_IDLE_MS,
  );

  protected readonly soundTypeOptions: { value: ChatSoundType; labelKey: string }[] = [
    { value: 'default', labelKey: 'account.soundDefault' },
    { value: 'chime',   labelKey: 'account.soundChime' },
    { value: 'bell',    labelKey: 'account.soundBell' },
    { value: 'pop',     labelKey: 'account.soundPop' },
  ];

  protected setFontScale(scale: FontScale): void {
    this.themeService.setFontScale(scale);
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected setDraftTtl(ttl: number): void {
    this.draftTtl.set(ttl);
    this.preferences.set(DRAFT_TTL_PREF_KEY, ttl);
  }

  protected setAmbientIdle(ms: number): void {
    this.ambientIdle.set(ms);
    this.preferences.set(AMBIENT_IDLE_PREF_KEY, ms);
    this.idleService.configure(ms);
  }

  protected readonly chatSoundEnabled = signal(this.chatNotification.soundEnabled);
  protected readonly chatVibrateEnabled = signal(this.chatNotification.vibrateEnabled);
  protected readonly chatPreviewPopupEnabled = signal(this.chatNotification.previewPopupEnabled);
  protected readonly chatSoundType = signal<ChatSoundType>(this.chatNotification.soundType);

  protected toggleChatSound(): void {
    const enabled = !this.chatSoundEnabled();
    this.chatSoundEnabled.set(enabled);
    this.chatNotification.setSoundEnabled(enabled);
  }

  protected toggleChatVibrate(): void {
    const enabled = !this.chatVibrateEnabled();
    this.chatVibrateEnabled.set(enabled);
    this.chatNotification.setVibrateEnabled(enabled);
  }

  protected toggleChatPreviewPopup(): void {
    const enabled = !this.chatPreviewPopupEnabled();
    this.chatPreviewPopupEnabled.set(enabled);
    this.chatNotification.setPreviewPopupEnabled(enabled);
  }

  protected setChatSoundType(type: ChatSoundType): void {
    this.chatSoundType.set(type);
    this.chatNotification.setSoundType(type);
  }
}
