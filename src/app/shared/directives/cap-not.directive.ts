import { Directive, TemplateRef, ViewContainerRef, computed, effect, inject, input } from '@angular/core';

import { CapabilityService } from '../services/capability.service';

/**
 * Inverse of `*appCap` — mounts its template only when the named capability
 * is DISABLED. Useful for fallbacks / "feature unavailable" placeholders.
 *
 *   <div *appCapNot="'CAP-EXT-CHAT'">Chat is not enabled on this install.</div>
 */
@Directive({
  selector: '[appCapNot]',
  standalone: true,
})
export class CapNotDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly capabilityService = inject(CapabilityService);

  readonly appCapNot = input<string>('');

  private readonly shouldRender = computed(() => {
    const code = this.appCapNot();
    // Empty (no binding) → don't render. Once bound, mirror the disabled state.
    return code ? !this.capabilityService.isEnabled(code) : false;
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
