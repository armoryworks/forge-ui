import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { CapabilityService } from '../../services/capability.service';
import { LayoutService } from '../../services/layout.service';
import { DEMO_MODULES, DemoModuleStateService } from '../../services/demo-module-state.service';

/**
 * Demo-only presenter control: a floating chip that switches which modules are
 * "on" in the stubbed demo. Changing the set reloads the capability descriptor,
 * which reconfigures nav + *appCap live — so a presenter can flip between the
 * Full suite and a cordoned single module (e.g. Inventory only) to show the
 * modular build. Renders nothing outside demo mode.
 */
@Component({
  selector: 'app-demo-module-switcher',
  standalone: true,
  imports: [],
  templateUrl: './demo-module-switcher.component.html',
  styleUrl: './demo-module-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoModuleSwitcherComponent {
  private readonly demoState = inject(DemoModuleStateService);
  private readonly capabilities = inject(CapabilityService);
  private readonly router = inject(Router);
  private readonly layout = inject(LayoutService);

  protected readonly show = environment.demoMode === true;
  protected readonly open = signal(false);

  protected readonly rows = computed(() => {
    const active = this.demoState.activeModules();
    return DEMO_MODULES.map(m => ({ ...m, on: active.has(m.id) }));
  });

  protected readonly summary = computed(() => {
    const active = this.demoState.activeModules();
    if (active.size >= DEMO_MODULES.length) return 'Full suite';
    if (active.size === 0) return 'None';
    if (active.size === 1 && active.has('inventory')) return 'Inventory';
    return `${active.size} modules`;
  });

  protected togglePanel(): void { this.open.update(o => !o); }

  protected selectFull(): void {
    this.demoState.selectAll();
    this.applyAndReload(this.layout.getDefaultRoute());
  }

  protected selectInventory(): void {
    this.demoState.selectInventoryOnly();
    this.applyAndReload('/inventory');
  }

  protected toggleModule(id: string): void {
    this.demoState.toggle(id);
    this.applyAndReload();
  }

  // Re-fetch the descriptor so nav + *appCap react to the new module set. When a
  // landing is given (preset switch), route there so the home matches the modules.
  private applyAndReload(navigateTo?: string): void {
    this.capabilities.load().subscribe(() => {
      if (navigateTo) this.router.navigateByUrl(navigateTo);
    });
  }
}
