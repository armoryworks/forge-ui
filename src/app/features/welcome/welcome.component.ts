import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { DEMO_MODULES, DemoModuleStateService } from '../../shared/services/demo-module-state.service';

interface FocusChoice { id: string; icon: string; modules: string[]; }
interface AddonChoice { id: string; icon: string; module: string; }

const ALL_MODULE_IDS = DEMO_MODULES.map(m => m.id);

// Tier 1 — plain "what does your shop do" choices, each a starter module set.
const FOCUS_CHOICES: FocusChoice[] = [
  { id: 'stock',   icon: 'inventory_2',             modules: ['inventory'] },
  { id: 'buying',  icon: 'local_shipping',          modules: ['inventory', 'purchasing'] },
  { id: 'selling', icon: 'sell',                    modules: ['inventory', 'sales', 'shipping'] },
  { id: 'making',  icon: 'precision_manufacturing', modules: ['inventory', 'production', 'purchasing'] },
];

// Tier 2 — a few optional add-ons in plain language. Deliberately shallow.
const ADDON_CHOICES: AddonChoice[] = [
  { id: 'invoicing', icon: 'receipt',         module: 'invoicing' },
  { id: 'quality',   icon: 'verified',        module: 'quality' },
  { id: 'planning',  icon: 'event_available', module: 'planning' },
];

/**
 * Demo welcome screen. Asks two plain-language questions up front (what to focus
 * on, then a couple of optional add-ons) and configures the demo's active modules
 * accordingly before sign-in, so a non-technical visitor lands in a demo scoped to
 * what they care about. "Show me everything" skips straight to the full suite.
 */
@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeComponent {
  private readonly demoState = inject(DemoModuleStateService);
  private readonly router = inject(Router);

  protected readonly step = signal<'focus' | 'addons'>('focus');
  protected readonly focusChoices = FOCUS_CHOICES;
  private readonly base = signal<string[]>([]);
  private readonly selectedAddons = signal<Set<string>>(new Set());

  // Don't offer an add-on the chosen focus already turns on.
  protected readonly addonRows = computed(() => {
    const base = this.base();
    const sel = this.selectedAddons();
    return ADDON_CHOICES
      .filter(a => !base.includes(a.module))
      .map(a => ({ ...a, on: sel.has(a.module) }));
  });

  protected chooseFocus(choice: FocusChoice): void {
    this.base.set(choice.modules);
    this.selectedAddons.set(new Set());
    this.step.set('addons');
  }

  protected toggleAddon(module: string): void {
    const next = new Set(this.selectedAddons());
    if (next.has(module)) { next.delete(module); } else { next.add(module); }
    this.selectedAddons.set(next);
  }

  protected back(): void {
    this.step.set('focus');
  }

  protected explore(): void {
    this.enter([...this.base(), ...this.selectedAddons()]);
  }

  protected showEverything(): void {
    this.enter(ALL_MODULE_IDS);
  }

  private enter(modules: string[]): void {
    // Persisted to localStorage by the demo state service, so it survives the hop
    // to /login and the app reads it when building the capability descriptor.
    this.demoState.setActive(modules);
    this.router.navigateByUrl('/login');
  }
}
