import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ThemeService } from '../../shared/services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  private readonly themeService = inject(ThemeService);

  protected readonly themeIcon = computed(() =>
    this.themeService.theme() === 'light' ? 'dark_mode' : 'light_mode',
  );

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
