import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PageHeaderComponent } from '../page-header/page-header.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

/**
 * Phase 1r — generic placeholder page used when a feature route is
 * registered but the underlying implementation hasn't landed yet. Lets
 * the routes resolve, sidebar items become selectable, and the
 * breadcrumb trail surface correctly while the real page is built.
 *
 * Each consumer wraps it in a thin component that supplies title +
 * subtitle + icon + i18n keys for the empty-state body so the
 * placeholder describes what's coming and which batch will fill it.
 *
 * Originally introduced as `LeadsStubPageComponent` for Batch 2; promoted
 * to shared/ in Batch 3 so the parallel customer sub-routes can reuse
 * the same shape without cross-feature imports.
 */
@Component({
  selector: 'app-stub-page',
  standalone: true,
  imports: [TranslatePipe, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header [title]="title() | translate" [subtitle]="subtitle() | translate" />
    <app-empty-state
      [icon]="icon()"
      [message]="emptyMessage() | translate"
      [helpText]="emptyHelp() | translate" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StubPageComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly icon = input.required<string>();
  readonly emptyMessage = input.required<string>();
  readonly emptyHelp = input<string>('');
}
