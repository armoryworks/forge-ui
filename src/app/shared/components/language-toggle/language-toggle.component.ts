import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService } from '../../services/language.service';

/**
 * Compact language switcher for surfaces without the desktop header menu —
 * the mobile shell and its enrollment screens. Floor-sized targets.
 */
@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './language-toggle.component.html',
  styleUrl: './language-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageToggleComponent {
  protected readonly languageService = inject(LanguageService);
  protected readonly current = this.languageService.currentLanguage;
  protected readonly languages = this.languageService.availableLanguages;
}
