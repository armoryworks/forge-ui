import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ControlledDocumentService } from '../../services/controlled-document.service';
import { ControlledDocument } from '../../models/controlled-document.model';
import { CONTROLLED_DOCUMENT_CATEGORIES } from '../../models/controlled-document-category.model';
import { CONTROLLED_DOCUMENT_STATUSES, CONTROLLED_DOCUMENT_STATUS_CHIP, ControlledDocumentStatus } from '../../models/controlled-document-status.model';
import { DOCUMENT_AUTHOR_ROLES } from '../../models/controlled-document-roles.model';
import { ControlledDocumentCreateDialogComponent } from '../../components/controlled-document-create-dialog/controlled-document-create-dialog.component';
import {
  ControlledDocumentDetailDialogComponent,
  ControlledDocumentDetailDialogData,
} from '../../components/controlled-document-detail-dialog/controlled-document-detail-dialog.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { AuthService } from '../../../../shared/services/auth.service';

@Component({
  selector: 'app-controlled-documents',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TranslatePipe, PageHeaderComponent, DataTableComponent, SelectComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './controlled-documents.component.html',
  styleUrl: './controlled-documents.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlledDocumentsComponent {
  private readonly documentService = inject(ControlledDocumentService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);

  protected readonly canAuthor = this.auth.hasAnyRole(DOCUMENT_AUTHOR_ROLES);
  protected readonly loading = signal(false);
  protected readonly documents = signal<ControlledDocument[]>([]);

  protected readonly categoryFilter = new FormControl<string | null>(null);
  protected readonly statusFilter = new FormControl<ControlledDocumentStatus | null>(null);

  protected readonly categoryOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('controlledDocuments.allCategories') },
    ...CONTROLLED_DOCUMENT_CATEGORIES.map(c => ({ value: c, label: this.translate.instant(`controlledDocuments.category${c}`) })),
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    ...CONTROLLED_DOCUMENT_STATUSES.map(s => ({ value: s, label: this.translate.instant(`controlledDocuments.status${s}`) })),
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'documentNumber', header: this.translate.instant('controlledDocuments.colNumber'), sortable: true, width: '120px' },
    { field: 'title', header: this.translate.instant('common.title'), sortable: true },
    { field: 'category', header: this.translate.instant('common.category'), sortable: true, width: '150px' },
    { field: 'appliesTo', header: this.translate.instant('controlledDocuments.colAppliesTo'), sortable: true, sortField: 'partNumber' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '110px' },
    { field: 'currentRevision', header: this.translate.instant('controlledDocuments.colRevision'), sortable: true, type: 'number', align: 'center', width: '80px' },
    { field: 'reviewDueDate', header: this.translate.instant('controlledDocuments.colReviewDue'), sortable: true, type: 'date', width: '120px' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.documentService.list({ category: this.categoryFilter.value, status: this.statusFilter.value }).subscribe({
      next: list => {
        this.documents.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusChip(status: ControlledDocumentStatus): string {
    return `chip ${CONTROLLED_DOCUMENT_STATUS_CHIP[status] ?? 'chip--muted'}`;
  }

  protected openCreate(): void {
    this.dialog.open<ControlledDocumentCreateDialogComponent, undefined, ControlledDocument | undefined>(
      ControlledDocumentCreateDialogComponent, { width: '560px' },
    ).afterClosed().subscribe(created => {
      if (!created) return;
      this.load();
      this.openDocument(created);
    });
  }

  protected openRow(row: unknown): void {
    this.openDocument(row as ControlledDocument);
  }

  private openDocument(document: ControlledDocument): void {
    this.dialog.open<ControlledDocumentDetailDialogComponent, ControlledDocumentDetailDialogData, boolean>(
      ControlledDocumentDetailDialogComponent, { width: '760px', maxWidth: '95vw', data: { document } },
    ).afterClosed().subscribe(changed => {
      if (changed) this.load();
    });
  }
}
