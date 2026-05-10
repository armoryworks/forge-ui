import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { Router } from '@angular/router';
import { LeadsService } from '../../services/leads.service';
import { SuppressedLeadSummary } from '../../models/suppression.model';

@Component({
  selector: 'app-leads-suppression',
  standalone: true,
  imports: [
    DatePipe, TranslatePipe,
    PageHeaderComponent, DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './leads-suppression.component.html',
  styleUrl: './leads-suppression.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsSuppressionComponent implements OnInit {
  private readonly service = inject(LeadsService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly rows = signal<SuppressedLeadSummary[]>([]);
  protected readonly loading = signal(true);

  protected readonly columns: ColumnDef[] = [
    { field: 'companyName', header: this.translate.instant('customers.companyName'), sortable: true },
    { field: 'contactName', header: this.translate.instant('customers.contactName'), sortable: true },
    { field: 'email', header: this.translate.instant('common.email'), sortable: true },
    { field: 'phone', header: this.translate.instant('common.phone'), sortable: true, width: '130px' },
    { field: 'channels', header: this.translate.instant('leads.suppression.colChannels'), width: '220px' },
    { field: 'cooldownUntil', header: this.translate.instant('leads.suppression.colCooldownUntil'), type: 'date', sortable: true, width: '120px' },
    { field: 'cooldownReasonCode', header: this.translate.instant('leads.suppression.colReason'), width: '140px' },
    { field: 'prefsUpdatedAt', header: this.translate.instant('common.lastUpdated'), type: 'date', sortable: true, width: '140px' },
  ];

  ngOnInit(): void {
    this.service.listSuppressed().subscribe({
      next: (data) => { this.rows.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openLead(row: SuppressedLeadSummary): void {
    // Navigate to /leads with ?detail=lead:N — the leads.component picks
    // this up on init and opens the existing lead-detail dialog, which
    // already surfaces outreach-preferences editing.
    this.router.navigate(['/leads'], { queryParams: { detail: `lead:${row.leadId}` } });
  }
}
