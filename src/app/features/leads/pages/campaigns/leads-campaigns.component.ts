import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { OutreachCampaignsService } from '../../services/outreach-campaigns.service';
import { OutreachCampaign } from '../../models/campaign.model';
import {
  CampaignDialogComponent,
  CampaignDialogData,
  CampaignDialogResult,
} from '../../components/campaign-dialog/campaign-dialog.component';

@Component({
  selector: 'app-leads-campaigns',
  standalone: true,
  imports: [
    TranslatePipe,
    PageHeaderComponent, DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './leads-campaigns.component.html',
  styleUrl: './leads-campaigns.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsCampaignsComponent implements OnInit {
  private readonly service = inject(OutreachCampaignsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly campaigns = signal<OutreachCampaign[]>([]);
  protected readonly loading = signal(true);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('leads.campaigns.fieldName'), sortable: true },
    { field: 'strategy', header: this.translate.instant('leads.intake.fieldStrategy'), sortable: true, width: '160px' },
    { field: 'leadCount', header: this.translate.instant('leads.campaigns.colLeads'), sortable: true, width: '90px', align: 'right' },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, width: '80px' },
    { field: 'startedAt', header: this.translate.instant('leads.campaigns.fieldStartedAt'), type: 'date', sortable: true, width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.created'), type: 'date', sortable: true, width: '110px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (data) => { this.campaigns.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.dialog.open<CampaignDialogComponent, CampaignDialogData, CampaignDialogResult | undefined>(
      CampaignDialogComponent, { width: '560px' },
    ).afterClosed().subscribe(result => {
      if (result?.mode === 'create') {
        this.service.create(result.request).subscribe({
          next: () => { this.snackbar.success(this.translate.instant('leads.campaigns.created')); this.load(); },
        });
      }
    });
  }

  protected openEdit(c: OutreachCampaign): void {
    this.dialog.open<CampaignDialogComponent, CampaignDialogData, CampaignDialogResult | undefined>(
      CampaignDialogComponent, { width: '560px', data: { campaign: c } satisfies CampaignDialogData },
    ).afterClosed().subscribe(result => {
      if (result?.mode === 'update') {
        this.service.update(result.id, result.request).subscribe({
          next: () => { this.snackbar.success(this.translate.instant('leads.campaigns.updated')); this.load(); },
        });
      }
    });
  }
}
