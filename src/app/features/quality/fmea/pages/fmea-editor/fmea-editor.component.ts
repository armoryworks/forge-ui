import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FmeaService } from '../../services/fmea.service';
import { Fmea } from '../../models/fmea.model';
import { FmeaItem } from '../../models/fmea-item.model';
import { FMEA_STATUSES, FMEA_STATUS_CHIP, FmeaStatus } from '../../models/fmea-status.model';
import { FMEA_HIGH_RPN_THRESHOLD } from '../../models/fmea-high-rpn.const';
import { FMEA_AUTHOR_ROLES } from '../../models/fmea-roles.model';
import { FmeaItemDialogComponent, FmeaItemDialogData } from '../../components/fmea-item-dialog/fmea-item-dialog.component';
import { FmeaActionDialogComponent, FmeaActionDialogData } from '../../components/fmea-action-dialog/fmea-action-dialog.component';
import { FmeaLinkCapaDialogComponent, FmeaLinkCapaDialogData } from '../../components/fmea-link-capa-dialog/fmea-link-capa-dialog.component';
import { PageHeaderComponent } from '../../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { AuthService } from '../../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { DateOnlyPipe } from '../../../../../shared/pipes/date-only.pipe';

@Component({
  selector: 'app-fmea-editor',
  standalone: true,
  imports: [
    DateOnlyPipe, ReactiveFormsModule, RouterLink, TranslatePipe,
    PageHeaderComponent, DataTableComponent, SelectComponent, ColumnCellDirective, LoadingBlockDirective,
  ],
  templateUrl: './fmea-editor.component.html',
  styleUrl: './fmea-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmeaEditorComponent {
  private readonly fmeaService = inject(FmeaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);

  protected readonly canEdit = this.auth.hasAnyRole(FMEA_AUTHOR_ROLES);
  protected readonly canLinkCapa = computed(() => this.canEdit && this.capabilities.isEnabled('CAP-QC-CAPA'));
  protected readonly fmea = signal<Fmea | null>(null);
  protected readonly loading = signal(false);
  protected readonly threshold = FMEA_HIGH_RPN_THRESHOLD;
  private readonly fmeaId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly statusControl = new FormControl<FmeaStatus>('Draft', { nonNullable: true });
  protected readonly statusOptions: SelectOption[] = FMEA_STATUSES.map(s => ({ value: s, label: this.translate.instant(`fmea.status${s}`) }));

  protected readonly items = computed(() => this.fmea()?.items ?? []);
  protected readonly openActions = computed(() =>
    this.items().filter(i => i.rpn >= this.threshold && !i.actionTaken).length);

  protected readonly columns = computed<ColumnDef[]>(() => [
    { field: 'itemNumber', header: '#', sortable: true, type: 'number', width: '50px' },
    { field: 'processStep', header: this.translate.instant('fmea.processStep'), sortable: true },
    { field: 'function', header: this.translate.instant('fmea.function') },
    { field: 'failureMode', header: this.translate.instant('fmea.failureMode'), sortable: true },
    { field: 'potentialEffect', header: this.translate.instant('fmea.effect') },
    { field: 'severity', header: this.translate.instant('fmea.colS'), type: 'number', align: 'center', width: '44px' },
    { field: 'potentialCause', header: this.translate.instant('fmea.cause') },
    { field: 'occurrence', header: this.translate.instant('fmea.colO'), type: 'number', align: 'center', width: '44px' },
    { field: 'controls', header: this.translate.instant('fmea.controls') },
    { field: 'detection', header: this.translate.instant('fmea.colD'), type: 'number', align: 'center', width: '44px' },
    { field: 'rpn', header: this.translate.instant('fmea.rpn'), sortable: true, type: 'number', align: 'right', width: '64px' },
    { field: 'recommendedAction', header: this.translate.instant('fmea.recommendedAction') },
    { field: 'revised', header: this.translate.instant('fmea.colRevised'), width: '120px' },
    ...(this.canEdit ? [{ field: 'actions', header: '', width: '150px', align: 'right' } as ColumnDef] : []),
  ]);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.fmeaService.get(this.fmeaId).subscribe({
      next: fmea => {
        this.fmea.set(fmea);
        this.statusControl.setValue(fmea.status, { emitEvent: false });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusChip(status: FmeaStatus): string {
    return `chip ${FMEA_STATUS_CHIP[status] ?? 'chip--muted'}`;
  }

  protected changeStatus(): void {
    const status = this.statusControl.value;
    if (!this.fmea() || status === this.fmea()!.status) return;
    this.fmeaService.update(this.fmeaId, { status }).subscribe({
      next: updated => {
        this.fmea.update(f => f ? { ...f, status: updated.status } : f);
        this.snackbar.success(this.translate.instant('fmea.statusChanged'));
      },
      error: (err: unknown) => {
        this.statusControl.setValue(this.fmea()!.status, { emitEvent: false });
        this.snackbar.errorFrom(err, 'fmea.saveFailed');
      },
    });
  }

  protected addItem(): void {
    this.openItemDialog(null);
  }

  protected editItem(item: FmeaItem): void {
    this.openItemDialog(item);
  }

  private openItemDialog(item: FmeaItem | null): void {
    this.dialog.open<FmeaItemDialogComponent, FmeaItemDialogData, FmeaItem | undefined>(
      FmeaItemDialogComponent, { width: '760px', maxWidth: '95vw', data: { fmeaId: this.fmeaId, item } },
    ).afterClosed().subscribe(saved => {
      if (saved) this.load();
    });
  }

  protected recordAction(item: FmeaItem): void {
    this.dialog.open<FmeaActionDialogComponent, FmeaActionDialogData, FmeaItem | undefined>(
      FmeaActionDialogComponent, { width: '560px', data: { fmeaId: this.fmeaId, item } },
    ).afterClosed().subscribe(saved => {
      if (saved) this.load();
    });
  }

  protected linkCapa(item: FmeaItem): void {
    this.dialog.open<FmeaLinkCapaDialogComponent, FmeaLinkCapaDialogData, boolean>(
      FmeaLinkCapaDialogComponent, { width: '480px', data: { fmeaId: this.fmeaId, item } },
    ).afterClosed().subscribe(linked => {
      if (linked) this.load();
    });
  }

  protected deleteItem(item: FmeaItem): void {
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('fmea.deleteItemTitle'),
        message: this.translate.instant('fmea.deleteItemMessage', { number: item.itemNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      },
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.fmeaService.deleteItem(this.fmeaId, item.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('fmea.itemDeleted'));
          this.load();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'fmea.saveFailed'),
      });
    });
  }

  protected openCapas(): void {
    this.router.navigate(['/quality', 'capas']);
  }
}
