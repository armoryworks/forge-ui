import { Directive, TemplateRef, ViewContainerRef, computed, effect, inject, input } from '@angular/core';

import { AuthService } from '../services/auth.service';

/**
 * Structural directive that mounts its template only when the current user holds
 * at least one of the named roles. The role counterpart to `*appCap`, so
 * permission-gated controls are *hidden* (not merely disabled) for users who may
 * not use them — per CLAUDE.md § permission hide-not-disable.
 *
 *   <button *appRole="['Admin','Manager']" (click)="archive()">Archive</button>
 *
 * Reactive: re-evaluates when the authenticated user changes because
 * `AuthService.user` is a signal. Accepts a single role string or an array.
 * For the inverse "render when the user LACKS these roles", use `*appRoleNot`.
 *
 * Note: UI gating is UX-only — the server still enforces authorization. Use this
 * for genuine permission gating, not for status/lifecycle visibility (those stay
 * as ordinary `@if` on a business-rule signal).
 */
@Directive({
  selector: '[appRole]',
  standalone: true,
})
export class RoleDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly appRole = input<string | readonly string[]>([]);

  private readonly shouldRender = computed(() => {
    const roles = this.appRole();
    const list = typeof roles === 'string' ? [roles] : roles;
    return list.length > 0 && this.auth.hasAnyRole([...list]);
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
