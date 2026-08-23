import { Directive, TemplateRef, ViewContainerRef, computed, effect, inject, input } from '@angular/core';

import { AuthService } from '../services/auth.service';

/**
 * Inverse of `*appRole` — mounts its template only when the current user holds
 * NONE of the named roles. Use for fallbacks shown to users who lack a permission.
 *
 *   <p *appRoleNot="['Admin']">Contact an administrator to change this.</p>
 */
@Directive({
  selector: '[appRoleNot]',
  standalone: true,
})
export class RoleNotDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly appRoleNot = input<string | readonly string[]>([]);

  private readonly shouldRender = computed(() => {
    const roles = this.appRoleNot();
    const list = typeof roles === 'string' ? [roles] : roles;
    return list.length === 0 || !this.auth.hasAnyRole([...list]);
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
