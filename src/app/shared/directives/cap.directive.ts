import { Directive, TemplateRef, ViewContainerRef, computed, effect, inject, input } from '@angular/core';

import { CapabilityService } from '../services/capability.service';

/**
 * Structural directive that mounts its template only when the named capability
 * is enabled. Mirrors the pattern documented in CLAUDE.md § Capability Gating.
 *
 *   <div *appCap="'CAP-MD-PART-COMPLIANCE'">…compliance fields…</div>
 *
 * Behaves like `*ngIf` against `capabilityService.isEnabled(code)`. When the
 * capability state changes (admin toggles, SignalR push), the template
 * mounts / unmounts reactively because `CapabilityService` exposes its state
 * as signals.
 *
 * For the inverse "render when DISABLED" case, use `*appCapNot` instead:
 *   <div *appCapNot="'CAP-EXT-CHAT'">…chat-disabled fallback…</div>
 *
 * Two distinct directive selectors keeps Angular's micro-syntax simple — no
 * compound expressions to parse and no surprises around shorthand binding.
 */
@Directive({
  selector: '[appCap]',
  standalone: true,
})
export class CapDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly capabilityService = inject(CapabilityService);

  readonly appCap = input<string>('');

  private readonly shouldRender = computed(() => {
    const code = this.appCap();
    return code ? this.capabilityService.isEnabled(code) : false;
  });

  constructor() {
    effect(() => {
      const render = this.shouldRender();
      if (render && this.viewContainer.length === 0) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else if (!render && this.viewContainer.length > 0) {
        this.viewContainer.clear();
      }
    });
  }
}
