import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { LayoutService } from '../../shared/services/layout.service';
import { NavTreeService } from '../../shared/services/nav-tree.service';
import { NavItem } from '../../shared/models/nav-item.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatTooltipModule, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  protected readonly layout = inject(LayoutService);
  private readonly navTree = inject(NavTreeService);

  protected readonly collapsed = computed(() => !this.layout.sidebarExpanded());
  protected readonly pinnedTopTree = this.navTree.pinnedTopTree;
  protected readonly mainTree = this.navTree.mainTree;
  protected readonly bottomTree = this.navTree.bottomTree;

  private readonly drillOverride = signal<NavItem[] | null>(null);
  protected readonly slideDirection = signal<'forward' | 'back'>('forward');

  protected readonly drillPath = computed(() => {
    const override = this.drillOverride();
    if (override !== null) return override;
    const trail = this.navTree.drillTrail();
    if (trail.length > 0 && !trail[trail.length - 1].children?.length) {
      return trail.slice(0, -1);
    }
    return trail;
  });

  protected readonly currentItems = computed(() => {
    const path = this.drillPath();
    if (path.length === 0) return null;
    return path[path.length - 1].children ?? [];
  });

  protected readonly drillHeader = computed(() => {
    const path = this.drillPath();
    return path.length === 0 ? null : path[path.length - 1];
  });

  protected readonly drillKey = computed(() =>
    this.drillPath().map(i => i.label).join('/') || '__root__',
  );

  constructor() {
    effect(() => {
      this.navTree.drillTrail();
      this.drillOverride.set(null);
    });
  }

  protected toggleCollapse(): void {
    this.layout.toggleSidebar();
  }

  protected onGroupClick(item: NavItem): void {
    this.slideDirection.set('forward');
    const current = this.drillPath();
    this.drillOverride.set([...current, item]);
    if (this.collapsed() && !this.layout.isMobile()) {
      this.layout.expandSidebar();
    }
  }

  /**
   * Pinned-bottom group clicks (Admin) RESET the drill to that group rather
   * than appending. If the user is currently drilled into Operations and
   * clicks Admin from the always-visible bottom region, they expect Admin's
   * children — not "Operations > Admin > children". Same behavior wherever
   * the user invokes them, regardless of current drill state.
   */
  protected onPinnedGroupClick(item: NavItem): void {
    this.slideDirection.set('forward');
    this.drillOverride.set([item]);
    if (this.collapsed() && !this.layout.isMobile()) {
      this.layout.expandSidebar();
    }
  }

  protected onBackClick(): void {
    this.slideDirection.set('back');
    const current = this.drillPath();
    this.drillOverride.set(current.slice(0, -1));
  }

  protected onLeafClick(): void {
    if (this.layout.isMobile()) {
      this.layout.closeMobileMenu();
    }
  }

  protected isInActiveTrail(item: NavItem): boolean {
    return this.navTree.breadcrumbTrail().includes(item);
  }

  protected isGroup(item: NavItem): boolean {
    return !!item.children?.length;
  }
}
