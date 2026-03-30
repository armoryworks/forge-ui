import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { FontScale, ThemeService } from '../../../../shared/services/theme.service';

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

  protected readonly theme = this.themeService.theme;
  protected readonly fontScale = this.themeService.fontScale;

  protected readonly fontScaleOptions: { value: FontScale; labelKey: string; hint: string }[] = [
    { value: 'default',     labelKey: 'account.fontScaleDefault',     hint: '12px' },
    { value: 'comfortable', labelKey: 'account.fontScaleComfortable',  hint: '14px' },
    { value: 'large',       labelKey: 'account.fontScaleLarge',        hint: '16px' },
    { value: 'xl',          labelKey: 'account.fontScaleXl',           hint: '18px' },
  ];

  protected setFontScale(scale: FontScale): void {
    this.themeService.setFontScale(scale);
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
