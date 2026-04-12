import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { PurchasingService } from './services/purchasing.service';
import { RfqListItem } from './models/rfq.model';
import { RfqListComponent } from './components/rfq-list/rfq-list.component';
import { RfqDialogComponent } from './components/rfq-dialog/rfq-dialog.component';
import { RfqDetailDialogComponent, RfqDetailDialogData } from './components/rfq-detail-dialog/rfq-detail-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';

@Component({
  selector: 'app-purchasing',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent, InputComponent, SelectComponent,
    RfqListComponent, RfqDialogComponent,
  ],
  templateUrl: './purchasing.component.html',
  styleUrl: './purchasing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchasingComponent {
  private readonly purchasingService = inject(PurchasingService);
  private readonly detailDialog = inject(DetailDialogService);

  protected readonly loading = signal(false);
  protected readonly rfqs = signal<RfqListItem[]>([]);
  protected readonly showCreateDialog = signal(false);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: 'All Statuses' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Sent', label: 'Sent' },
    { value: 'Receiving', label: 'Receiving' },
    { value: 'EvaluatingResponses', label: 'Evaluating' },
    { value: 'Awarded', label: 'Awarded' },
    { value: 'Cancelled', label: 'Cancelled' },
    { value: 'Expired', label: 'Expired' },
  ];

  constructor() {
    this.loadRfqs();
  }

  protected loadRfqs(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    const status = this.statusFilterControl.value ?? undefined;
    this.purchasingService.getRfqs(status, search).subscribe({
      next: (list) => {
        this.rfqs.set(list);
        this.loading.set(false);
        const detail = this.detailDialog.getDetailFromUrl();
        if (detail?.entityType === 'rfq') {
          this.openRfqDetail({ id: detail.entityId } as RfqListItem);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void {
    this.loadRfqs();
  }

  protected openRfqDetail(item: RfqListItem): void {
    this.detailDialog.open<RfqDetailDialogComponent, RfqDetailDialogData, boolean>(
      'rfq',
      item.id,
      RfqDetailDialogComponent,
      { rfqId: item.id },
    ).afterClosed().subscribe(changed => {
      if (changed) this.loadRfqs();
    });
  }

  protected openCreateDialog(): void {
    this.showCreateDialog.set(true);
  }

  protected closeCreateDialog(): void {
    this.showCreateDialog.set(false);
  }

  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadRfqs();
  }
}
