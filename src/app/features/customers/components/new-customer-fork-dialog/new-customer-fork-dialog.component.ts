import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';

/**
 * Phase 1o.2 — three-way fork at "+ New Customer". Mirrors the lead-fork
 * dialog idiom: Quick add as the dominant path, guided setup for net-new
 * customers worth the upfront investment, and "Convert from lead" for
 * the case where a lead already exists.
 *
 * Returns a string indicating the path the user picked. Caller routes:
 *   "quick"   → existing inline customer dialog (flat 7-field form)
 *   "fromLead" → lead picker → existing lead-convert stepper
 *   "guided"  → multi-step new-customer wizard (phase 1o.3)
 */
export type CustomerCreatePath = 'quick' | 'fromLead' | 'guided';

interface PathChoice {
  value: CustomerCreatePath;
  titleKey: string;
  descKey: string;
  icon: string;
  badgeKey?: string;
}

@Component({
  selector: 'app-new-customer-fork-dialog',
  standalone: true,
  imports: [TranslatePipe, DialogComponent],
  templateUrl: './new-customer-fork-dialog.component.html',
  styleUrl: './new-customer-fork-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewCustomerForkDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewCustomerForkDialogComponent, CustomerCreatePath | undefined>);
  protected readonly translate = inject(TranslateService);

  protected readonly choices: readonly PathChoice[] = [
    {
      value: 'quick',
      titleKey: 'customers.fork.quickTitle',
      descKey: 'customers.fork.quickDesc',
      icon: 'flash_on',
      badgeKey: 'customers.fork.quickBadge',
    },
    {
      value: 'fromLead',
      titleKey: 'customers.fork.fromLeadTitle',
      descKey: 'customers.fork.fromLeadDesc',
      icon: 'person_add',
    },
    {
      value: 'guided',
      titleKey: 'customers.fork.guidedTitle',
      descKey: 'customers.fork.guidedDesc',
      icon: 'tune',
    },
  ];

  protected pick(path: CustomerCreatePath): void {
    this.dialogRef.close(path);
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
