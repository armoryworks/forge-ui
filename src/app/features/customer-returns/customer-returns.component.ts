import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CustomerReturnService } from './services/customer-return.service';
import { CustomerReturnListItem } from './models/customer-return-list-item.model';
import { CustomerReturnDetail } from './models/customer-return-detail.model';
import { CustomerReturnDialogComponent } from './components/customer-return-dialog/customer-return-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { DetailSidePanelComponent } from '../../shared/components/detail-side-panel/detail-side-panel.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { FormGroup, FormControl as FC, Validators } from '@angular/forms';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';

@Component({
  selector: 'app-customer-returns',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, DetailSidePanelComponent,
    CustomerReturnDialogComponent, LoadingBlockDirective, DialogComponent,
    TextareaComponent, ValidationPopoverDirective, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './customer-returns.component.html',
  styleUrl: './customer-returns.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReturnsComponent {
  private readonly service = inject(CustomerReturnService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly returns = signal<CustomerReturnListItem[]>([]);
  protected readonly selected = signal<CustomerReturnDetail | null>(null);

  protected readonly showCreateDialog = signal(false);
  protected readonly showResolveDialog = signal(false);
  protected readonly resolveSaving = signal(false);

  protected readonly resolveForm = new FormGroup({
    inspectionNotes: new FC('', [Validators.maxLength(1000)]),
  });

  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('customerReturns.allStatuses') },
    { value: 'Received', label: 'Received' },
    { value: 'ReworkOrdered', label: 'Rework Ordered' },
    { value: 'InInspection', label: 'In Inspection' },
    { value: 'Resolved', label: 'Resolved' },
    { value: 'Closed', label: 'Closed' },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'returnNumber', header: this.translate.instant('customerReturns.returnNumber'), sortable: true, width: '150px' },
    { field: 'customerName', header: this.translate.instant('common.customer'), sortable: true },
    { field: 'originalJobNumber', header: this.translate.instant('customerReturns.originalJob'), sortable: true, width: '130px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '140px',
      filterOptions: [
        { value: 'Received', label: 'Received' },
        { value: 'ReworkOrdered', label: 'Rework Ordered' },
        { value: 'InInspection', label: 'In Inspection' },
        { value: 'Resolved', label: 'Resolved' },
        { value: 'Closed', label: 'Closed' },
      ]},
    { field: 'reason', header: this.translate.instant('customerReturns.reason'), sortable: true },
    { field: 'returnDate', header: this.translate.instant('customerReturns.returnDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.createdAt'), sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly rowClass = (row: unknown) => {
    const r = row as CustomerReturnListItem;
    return r.id === this.selected()?.id ? 'row--selected' : '';
  };

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const status = this.statusFilterControl.value ?? undefined;
    this.service.getReturns(undefined, status).subscribe({
      next: (list) => { this.returns.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.load(); }

  protected selectReturn(row: unknown): void {
    const item = row as CustomerReturnListItem;
    this.service.getById(item.id).subscribe({
      next: (detail) => this.selected.set(detail),
    });
  }

  protected closeDetail(): void { this.selected.set(null); }

  protected openCreate(): void { this.showCreateDialog.set(true); }
  protected closeCreate(): void { this.showCreateDialog.set(false); }

  protected onCreated(): void {
    this.closeCreate();
    this.load();
  }

  protected openResolve(): void {
    this.resolveForm.reset();
    this.showResolveDialog.set(true);
  }

  protected closeResolveDialog(): void { this.showResolveDialog.set(false); }

  protected resolve(): void {
    const r = this.selected();
    if (!r) return;
    this.resolveSaving.set(true);
    const notes = this.resolveForm.value.inspectionNotes || undefined;
    this.service.resolve(r.id, notes).subscribe({
      next: (detail) => {
        this.selected.set(detail);
        this.load();
        this.resolveSaving.set(false);
        this.closeResolveDialog();
        this.snackbar.success(this.translate.instant('customerReturns.resolved'));
      },
      error: () => this.resolveSaving.set(false),
    });
  }

  protected close(r: CustomerReturnDetail): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customerReturns.closeTitle'),
        message: this.translate.instant('customerReturns.closeMessage', { number: r.returnNumber }),
        confirmLabel: this.translate.instant('customerReturns.closeConfirm'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.close(r.id).subscribe({
        next: (detail) => {
          this.selected.set(detail);
          this.load();
          this.snackbar.success(this.translate.instant('customerReturns.closed'));
        },
      });
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Received: 'chip--info',
      ReworkOrdered: 'chip--warning',
      InInspection: 'chip--primary',
      Resolved: 'chip--success',
      Closed: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      ReworkOrdered: 'Rework Ordered',
      InInspection: 'In Inspection',
    };
    return labels[status] ?? status;
  }
}
