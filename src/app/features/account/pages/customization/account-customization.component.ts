import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { FontScale, ThemeService } from '../../../../shared/services/theme.service';
import { UserPreferencesService } from '../../../../shared/services/user-preferences.service';
import { ChatNotificationService } from '../../../../shared/services/chat-notification.service';
import { DRAFT_TTL_OPTIONS, DEFAULT_DRAFT_TTL, DraftTtlOption } from '../../../../shared/models/draft-ttl.model';

const DRAFT_TTL_PREF_KEY = 'draft:ttlMs';

@Component({
  selector: 'app-account-customization',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './account-customization.component.html',
  styleUrl: './account-customization.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountCustomizationComponent {
  private readonly themeService = inject(ThemeService);
  private readonly preferences = inject(UserPreferencesService);
  protected readonly chatNotification = inject(ChatNotificationService);

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

  protected readonly chatSoundEnabled = signal(this.chatNotification.soundEnabled);
  protected readonly chatVibrateEnabled = signal(this.chatNotification.vibrateEnabled);

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
}
