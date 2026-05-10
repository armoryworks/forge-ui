import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

/**
 * Phase 1r / Batch 2 — placeholder page for the new /leads/* sub-routes
 * (intake / queue / campaigns / suppression). Real implementations land
 * in Batches 4-6. The stub exists so the routes resolve, the sidebar
 * submenu item is selectable, and the breadcrumb trail looks right
 * before the underlying feature is built.
 *
 * Each route registers its own thin wrapper component that supplies
 * title + subtitle + icon via inputs.
 */
@Component({
  selector: 'app-leads-stub-page',
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
export class LeadsStubPageComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly icon = input.required<string>();
  readonly emptyMessage = input.required<string>();
  readonly emptyHelp = input<string>('');
}
