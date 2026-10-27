import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FmeaService } from '../../services/fmea.service';
import { Fmea } from '../../models/fmea.model';
import { FmeaItem } from '../../models/fmea-item.model';
import { FMEA_STATUSES, FMEA_STATUS_CHIP, FmeaStatus } from '../../models/fmea-status.model';
import { FMEA_TYPES, FmeaType } from '../../models/fmea-type.model';
import { FMEA_HIGH_RPN_THRESHOLD } from '../../models/fmea-high-rpn.const';
import { FMEA_AUTHOR_ROLES } from '../../models/fmea-roles.model';
import { FmeaCreateDialogComponent } from '../../components/fmea-create-dialog/fmea-create-dialog.component';
import { PageHeaderComponent } from '../../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../../shared/directives/loading-block.directive';
import { TabListDirective, TabDirective } from '../../../../../shared/directives/tab-list.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { AuthService } from '../../../../../shared/services/auth.service';

type FmeaListView = 'analyses' | 'high-rpn';

@Component({
  selector: 'app-fmea-list',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    PageHeaderComponent, DataTableComponent, SelectComponent, ColumnCellDirective, LoadingBlockDirective,
    TabListDirective, TabDirective,
  ],
  templateUrl: './fmea-list.component.html',
  styleUrl: './fmea-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmeaListComponent {
  private readonly fmeaService = inject(FmeaService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);

  protected readonly canAuthor = this.auth.hasAnyRole(FMEA_AUTHOR_ROLES);
  protected readonly view = signal<FmeaListView>('analyses');
  protected readonly loading = signal(false);
  protected readonly fmeas = signal<Fmea[]>([]);
  protected readonly highRpnItems = signal<FmeaItem[]>([]);
  protected readonly threshold = FMEA_HIGH_RPN_THRESHOLD;

  protected readonly typeFilter = new FormControl<FmeaType | null>(null);
  protected readonly statusFilter = new FormControl<FmeaStatus | null>(null);

  protected readonly typeOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('fmea.allTypes') },
    ...FMEA_TYPES.map(t => ({ value: t, label: this.translate.instant(`fmea.type${t}`) })),
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    ...FMEA_STATUSES.map(s => ({ value: s, label: this.translate.instant(`fmea.status${s}`) })),
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'fmeaNumber', header: this.translate.instant('fmea.colNumber'), sortable: true, width: '130px' },
    { field: 'name', header: this.translate.instant('common.name'), sortable: true },
    { field: 'type', header: this.translate.instant('common.type'), sortable: true, width: '100px' },
    { field: 'subject', header: this.translate.instant('fmea.colSubject'), sortable: true, sortField: 'partNumber' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '110px' },
    { field: 'maxRpn', header: this.translate.instant('fmea.colMaxRpn'), sortable: true, type: 'number', align: 'right', width: '100px' },
    { field: 'highRpnCount', header: this.translate.instant('fmea.colHighRpn'), sortable: true, type: 'number', align: 'right', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.createdAt'), sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly highRpnColumns: ColumnDef[] = [
    { field: 'fmeaNumber', header: this.translate.instant('fmea.colNumber'), sortable: true, width: '130px' },
    { field: 'failureMode', header: this.translate.instant('fmea.failureMode'), sortable: true },
    { field: 'potentialEffect', header: this.translate.instant('fmea.effect'), sortable: true },
    { field: 'sod', header: this.translate.instant('fmea.colSod'), width: '90px', align: 'center' },
    { field: 'rpn', header: this.translate.instant('fmea.rpn'), sortable: true, type: 'number', align: 'right', width: '80px' },
    { field: 'recommendedAction', header: this.translate.instant('fmea.recommendedAction') },
  ];

  protected readonly highRpnRows = computed(() => this.highRpnItems());

  constructor() {
    this.load();
  }

  protected switchView(view: FmeaListView): void {
    this.view.set(view);
    if (view === 'high-rpn') this.loadHighRpn();
    else this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.fmeaService.list({ type: this.typeFilter.value ?? undefined, status: this.statusFilter.value ?? undefined }).subscribe({
      next: list => {
        this.fmeas.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadHighRpn(): void {
    this.loading.set(true);
    this.fmeaService.highRpn(this.threshold - 1).subscribe({
      next: items => {
        this.highRpnItems.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusChip(status: FmeaStatus): string {
    return `chip ${FMEA_STATUS_CHIP[status] ?? 'chip--muted'}`;
  }

  protected open(row: unknown): void {
    this.router.navigate(['/quality/fmea', (row as Fmea).id]);
  }

  protected openItem(row: unknown): void {
    const item = row as FmeaItem;
    if (item.fmeaId) this.router.navigate(['/quality/fmea', item.fmeaId]);
  }

  protected openCreate(): void {
    this.dialog.open<FmeaCreateDialogComponent, undefined, Fmea | undefined>(FmeaCreateDialogComponent, { width: '520px' })
      .afterClosed().subscribe(created => {
        if (created) this.router.navigate(['/quality/fmea', created.id]);
      });
  }
}
