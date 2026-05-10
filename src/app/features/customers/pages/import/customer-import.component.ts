import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

interface ImportStep {
  number: number;
  icon: string;
  titleKey: string;
  descriptionKey: string;
}

/**
 * Phase 1r — placeholder for the customer bulk-import wizard. Real upload +
 * dedupe + commit flow ships in a follow-on (mirrors the leads bulk-intake
 * pattern, but with billing/shipping addresses + credit terms + contacts as
 * a hierarchy). This page describes what the flow will look like so admins
 * can plan their CSV format.
 */
@Component({
  selector: 'app-customer-import-page',
  standalone: true,
  imports: [TranslatePipe, PageHeaderComponent],
  templateUrl: './customer-import.component.html',
  styleUrl: './customer-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerImportPageComponent {
  protected readonly steps: ImportStep[] = [
    {
      number: 1, icon: 'upload_file',
      titleKey: 'customers.importPage.steps.upload.title',
      descriptionKey: 'customers.importPage.steps.upload.description',
    },
    {
      number: 2, icon: 'compare_arrows',
      titleKey: 'customers.importPage.steps.dedupe.title',
      descriptionKey: 'customers.importPage.steps.dedupe.description',
    },
    {
      number: 3, icon: 'rule',
      titleKey: 'customers.importPage.steps.review.title',
      descriptionKey: 'customers.importPage.steps.review.description',
    },
    {
      number: 4, icon: 'cloud_done',
      titleKey: 'customers.importPage.steps.commit.title',
      descriptionKey: 'customers.importPage.steps.commit.description',
    },
  ];

  protected readonly expectedColumns: string[] = [
    'name (required)',
    'companyName',
    'email',
    'phone',
    'billing.line1 / billing.city / billing.state / billing.postal',
    'shipping.line1 / shipping.city / shipping.state / shipping.postal',
    'creditTerms (Net15 | Net30 | Net60 | COD | Prepaid)',
    'creditLimit',
    'contact.firstName / contact.lastName / contact.email / contact.phone',
  ];
}
