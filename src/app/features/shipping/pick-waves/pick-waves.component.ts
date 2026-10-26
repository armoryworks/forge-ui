import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PickWaveService } from './services/pick-wave.service';
import { PickWave } from './models/pick-wave.model';
import { PickWaveStatus } from './models/pick-wave-status.model';
import { PICK_STATUS_CHIP } from './models/pick-status-chip.model';
import { PickWaveDetailPanelComponent } from './components/pick-wave-detail-panel/pick-wave-detail-panel.component';
import { AutoGenerateWaveDialogComponent } from './components/auto-generate-wave-dialog/auto-generate-wave-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DetailSidePanelComponent } from '../../../shared/components/detail-side-panel/detail-side-panel.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { parsePositiveId } from '../../../shared/utils/parse-positive-id';

const STATUSES: readonly PickWaveStatus[] = ['Draft', 'Released', 'InProgress', 'Completed', 'Cancelled'];

/**
 * Shipping > Pick waves: the waves (status, lines picked of total, created), auto-generating a new one from
 * the open shipment lines, and the selected wave's lines in a side panel (`?wave=<id>`).
 */
@Component({
  selector: 'app-pick-waves',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    PageHeaderComponent, SelectComponent, DataTableComponent, DetailSidePanelComponent, ColumnCellDirective, LoadingBlockDirective,
    PickWaveDetailPanelComponent, AutoGenerateWaveDialogComponent,
  ],
  templateUrl: './pick-waves.component.html',
  styleUrl: './pick-waves.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickWavesComponent {
  private readonly pickWaves = inject(PickWaveService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly waves = signal<PickWave[]>([]);
  protected readonly loading = signal(false);
  protected readonly showGenerate = signal(false);
  protected readonly statusChip = PICK_STATUS_CHIP;

  protected readonly statusControl = new FormControl<PickWaveStatus | null>(null);
  private readonly statusFilter = toSignal(this.statusControl.valueChanges.pipe(startWith(null)), { initialValue: null });

  protected readonly selectedId = toSignal(
    this.route.queryParamMap.pipe(map(params => parsePositiveId(params.get('wave')))),
    { initialValue: null });

  protected readonly selectedWave = computed(() => this.waves().find(w => w.id === this.selectedId()) ?? null);

  protected readonly filteredWaves = computed(() => {
    const status = this.statusFilter();
    return status ? this.waves().filter(w => w.status === status) : this.waves();
  });

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('pickWaves.allStatuses') },
    ...STATUSES.map(s => ({ value: s, label: this.translate.instant(`pickWaves.status.${s}`) })),
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'waveNumber', header: this.translate.instant('pickWaves.cols.wave'), sortable: true, width: '120px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
    { field: 'strategy', header: this.translate.instant('pickWaves.cols.strategy'), sortable: true, width: '120px' },
    { field: 'pickedLines', header: this.translate.instant('pickWaves.cols.progress'), sortable: true, width: '110px', align: 'right' },
    { field: 'assignedToName', header: this.translate.instant('pickWaves.cols.assignedTo'), sortable: true },
    { field: 'createdAt', header: this.translate.instant('common.createdAt'), sortable: true, type: 'date', width: '120px' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.pickWaves.getWaves().subscribe({
      next: rows => { this.waves.set(rows); this.loading.set(false); },
      error: (err: unknown) => { this.loading.set(false); this.snackbar.errorFrom(err, 'pickWaves.loadFailed'); },
    });
  }

  protected openWave(wave: PickWave): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { wave: wave.id }, queryParamsHandling: 'merge' });
  }

  protected closeWave(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { wave: null }, queryParamsHandling: 'merge' });
  }

  protected onGenerated(wave: PickWave): void {
    this.showGenerate.set(false);
    this.load();
    this.openWave(wave);
  }
}
