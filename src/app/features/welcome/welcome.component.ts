import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

interface FeatureTile {
  readonly icon: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly route: string;
}

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeComponent {
  protected readonly tiles: readonly FeatureTile[] = [
    {
      icon: 'view_kanban',
      titleKey: 'welcomePage.tiles.kanban.title',
      descriptionKey: 'welcomePage.tiles.kanban.description',
      route: '/kanban',
    },
    {
      icon: 'dashboard',
      titleKey: 'welcomePage.tiles.dashboard.title',
      descriptionKey: 'welcomePage.tiles.dashboard.description',
      route: '/dashboard',
    },
    {
      icon: 'factory',
      titleKey: 'welcomePage.tiles.shopFloor.title',
      descriptionKey: 'welcomePage.tiles.shopFloor.description',
      route: '/display/shop-floor',
    },
    {
      icon: 'inventory_2',
      titleKey: 'welcomePage.tiles.parts.title',
      descriptionKey: 'welcomePage.tiles.parts.description',
      route: '/parts',
    },
    {
      icon: 'request_quote',
      titleKey: 'welcomePage.tiles.quoteToCash.title',
      descriptionKey: 'welcomePage.tiles.quoteToCash.description',
      route: '/quotes',
    },
    {
      icon: 'insights',
      titleKey: 'welcomePage.tiles.reports.title',
      descriptionKey: 'welcomePage.tiles.reports.description',
      route: '/reports',
    },
    {
      icon: 'verified',
      titleKey: 'welcomePage.tiles.quality.title',
      descriptionKey: 'welcomePage.tiles.quality.description',
      route: '/quality',
    },
    {
      icon: 'admin_panel_settings',
      titleKey: 'welcomePage.tiles.admin.title',
      descriptionKey: 'welcomePage.tiles.admin.description',
      route: '/admin',
    },
  ];
}
