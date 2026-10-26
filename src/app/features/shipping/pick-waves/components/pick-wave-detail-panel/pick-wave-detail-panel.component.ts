import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MatDialog } from '@angular/material/dialog';

import { PickWaveService } from '../../services/pick-wave.service';
import { PickWave } from '../../models/pick-wave.model';
import { PickLine } from '../../models/pick-line.model';
import { PICK_STATUS_CHIP } from '../../models/pick-status-chip.model';
import { ConfirmPickLineDialogComponent } from '../confirm-pick-line-dialog/confirm-pick-line-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingBlockDirective } from '../../../../../shared/directives/loading-block.directive';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { DateTimePipe } from '../../../../../shared/pipes/date-time.pipe';
import { FileDownloadService } from '../../../../../shared/services/file-download.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

/**
 * One pick wave: its lines in walk order (part, bin, lot, to pick, picked), with release, per-line confirm,
 * complete and the printable pick list.
 */
@Component({
  selector: 'app-pick-wave-detail-panel',
  standalone: true,
  imports: [
    DecimalPipe, TranslatePipe, DateTimePipe, LoadingBlockDirective, DataTableComponent, ColumnCellDirective, ConfirmPickLineDialogComponent,
  ],
  templateUrl: './pick-wave-detail-panel.component.html',
  styleUrl: './pick-wave-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickWaveDetailPanelComponent {
  private readonly pickWaves = inject(PickWaveService);
  private readonly files = inject(FileDownloadService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly waveId = input.required<number>();
  readonly changed = output<void>();

  protected readonly wave = signal<PickWave | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly confirming = signal<PickLine | null>(null);
  protected readonly statusChip = PICK_STATUS_CHIP;

  protected readonly canRelease = computed(() => this.wave()?.status === 'Draft' && (this.wave()?.totalLines ?? 0) > 0);
  protected readonly canPick = computed(() => this.wave()?.status === 'Released' || this.wave()?.status === 'InProgress');
  protected readonly pendingCount = computed(() => this.wave()?.lines.filter(l => l.status === 'Pending').length ?? 0);

  protected readonly columns = computed<ColumnDef[]>(() => [
    { field: 'sortOrder', header: '#', sortable: true, width: '50px', type: 'number' },
    { field: 'partNumber', header: this.translate.instant('pickWaves.lines.part'), sortable: true },
    { field: 'binPath', header: this.translate.instant('pickWaves.lines.from'), sortable: true },
    { field: 'lotNumber', header: this.translate.instant('pickWaves.lines.lot'), sortable: true, width: '110px' },
    { field: 'requestedQuantity', header: this.translate.instant('pickWaves.lines.toPick'), sortable: true, align: 'right', width: '90px' },
    { field: 'pickedQuantity', header: this.translate.instant('pickWaves.lines.picked'), sortable: true, align: 'right', width: '90px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
    ...(this.canPick() ? [{ field: 'actions', header: this.translate.instant('common.actions'), width: '130px', exportable: false }] : []),
  ]);

  constructor() {
    effect(() => {
      const id = this.waveId();
      untracked(() => this.load(id));
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.pickWaves.getWave(id).subscribe({
      next: wave => { this.wave.set(wave); this.loading.set(false); },
      error: (err: unknown) => { this.loading.set(false); this.snackbar.errorFrom(err, 'pickWaves.loadFailed'); },
    });
  }

  private reload(): void {
    this.load(this.waveId());
    this.changed.emit();
  }

  protected release(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.pickWaves.release(this.waveId()).subscribe({
      next: () => {
        this.busy.set(false);
        this.snackbar.success(this.translate.instant('pickWaves.released'));
        this.reload();
      },
      error: (err: unknown) => { this.busy.set(false); this.snackbar.errorFrom(err, 'pickWaves.releaseFailed'); },
    });
  }

  protected complete(): void {
    const pending = this.pendingCount();
    const run = () => {
      this.busy.set(true);
      this.pickWaves.complete(this.waveId()).subscribe({
        next: () => {
          this.busy.set(false);
          this.snackbar.success(this.translate.instant('pickWaves.completed'));
          this.reload();
        },
        error: (err: unknown) => { this.busy.set(false); this.snackbar.errorFrom(err, 'pickWaves.completeFailed'); },
      });
    };
    if (pending === 0) {
      run();
      return;
    }
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('pickWaves.completeTitle'),
        message: this.translate.instant('pickWaves.completeMessage', { count: pending }),
        confirmLabel: this.translate.instant('pickWaves.complete'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) run();
    });
  }

  protected print(): void {
    const wave = this.wave();
    if (!wave) return;
    this.files.open(this.pickWaves.pdfUrl(wave.id), `pick-list-${wave.waveNumber}.pdf`);
  }

  protected openConfirm(line: PickLine): void {
    this.confirming.set(line);
  }

  protected onConfirmed(): void {
    this.confirming.set(null);
    this.reload();
  }
}
