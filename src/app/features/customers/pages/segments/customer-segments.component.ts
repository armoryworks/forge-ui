import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

interface SegmentPreview {
  name: string;
  description: string;
  filterSummary: string;
  estimatedCount: number;
}

/**
 * Phase 1r — placeholder for the saved-segment feature. Real CRUD ships in
 * a follow-on (segments table + filter-builder UI). This page renders
 * representative example segments so admins can understand what the
 * feature will deliver before it's built.
 */
@Component({
  selector: 'app-customer-segments-page',
  standalone: true,
  imports: [TranslatePipe, PageHeaderComponent],
  templateUrl: './customer-segments.component.html',
  styleUrl: './customer-segments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerSegmentsPageComponent {
  private readonly translate = inject(TranslateService);

  protected readonly examples: SegmentPreview[] = [
    {
      name: this.translate.instant('customers.segmentsPage.examples.aerospaceHighValue.name'),
      description: this.translate.instant('customers.segmentsPage.examples.aerospaceHighValue.description'),
      filterSummary: 'isAerospace = true AND openInvoiceTotal > $10K',
      estimatedCount: 12,
    },
    {
      name: this.translate.instant('customers.segmentsPage.examples.itarReady.name'),
      description: this.translate.instant('customers.segmentsPage.examples.itarReady.description'),
      filterSummary: 'isItarControlled = true AND isReferenceOk = true',
      estimatedCount: 4,
    },
    {
      name: this.translate.instant('customers.segmentsPage.examples.dormant90.name'),
      description: this.translate.instant('customers.segmentsPage.examples.dormant90.description'),
      filterSummary: 'isActive = true AND lastOrderAt < (today - 90d)',
      estimatedCount: 27,
    },
    {
      name: this.translate.instant('customers.segmentsPage.examples.creditWatch.name'),
      description: this.translate.instant('customers.segmentsPage.examples.creditWatch.description'),
      filterSummary: 'isOnCreditHold = true OR (openInvoiceTotal > creditLimit * 0.8)',
      estimatedCount: 8,
    },
  ];
}
