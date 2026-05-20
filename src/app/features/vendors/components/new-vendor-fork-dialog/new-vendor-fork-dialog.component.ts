import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';

/**
 * Two-way fork at "+ New Vendor". Mirrors the customer fork idiom:
 * Quick add as the dominant path for the everyday transactional supplier,
 * and a guided setup for strategic / approved-vendor-list partners worth
 * the upfront effort (classification, address, terms, supplied parts).
 *
 * Vendors have no "convert from lead" path (leads become customers), so
 * this fork is two-way rather than the customer's three-way.
 *
 * Returns the chosen path. Caller routes:
 *   "quick"  → existing inline vendor dialog (flat form)
 *   "guided" → multi-step guided vendor wizard
 */
export type VendorCreatePath = 'quick' | 'guided';

interface PathChoice {
  value: VendorCreatePath;
  titleKey: string;
  descKey: string;
  icon: string;
  badgeKey?: string;
}

@Component({
  selector: 'app-new-vendor-fork-dialog',
  standalone: true,
  imports: [TranslatePipe, DialogComponent],
  templateUrl: './new-vendor-fork-dialog.component.html',
  styleUrl: './new-vendor-fork-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewVendorForkDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewVendorForkDialogComponent, VendorCreatePath | undefined>);

  protected readonly choices: readonly PathChoice[] = [
    {
      value: 'quick',
      titleKey: 'vendors.fork.quickTitle',
      descKey: 'vendors.fork.quickDesc',
      icon: 'flash_on',
      badgeKey: 'vendors.fork.quickBadge',
    },
    {
      value: 'guided',
      titleKey: 'vendors.fork.guidedTitle',
      descKey: 'vendors.fork.guidedDesc',
      icon: 'tune',
    },
  ];

  protected pick(path: VendorCreatePath): void {
    this.dialogRef.close(path);
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
