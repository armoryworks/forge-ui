import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { catchError, forkJoin, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { InventoryService } from '../../services/inventory.service';
import { AtpBucket, AtpResult } from '../../models/atp.model';
import { ATP_ROLES } from '../../models/atp-roles.model';
import { PartBinLocation } from '../../models/part-bin-location.model';

/**
 * Available to promise for one part: on hand, reserved, demand from open sales orders, scheduled receipts
 * from open purchase orders, the quantity still free to promise, the earliest date a quantity can be met,
 * and the week-by-week supply and demand behind it.
 */
@Component({
  selector: 'app-part-atp-panel',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, TranslatePipe, DateOnlyPipe, DataTableComponent, ColumnCellDirective, InputComponent, LoadingBlockDirective],
  templateUrl: './part-atp-panel.component.html',
  styleUrl: './part-atp-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartAtpPanelComponent {
  private readonly inventoryService = inject(InventoryService);
  private readonly capabilities = inject(CapabilityService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  readonly partId = input.required<number>();

  protected readonly visible = computed(() =>
    this.capabilities.isEnabled('CAP-INV-CORE') && this.capabilities.isEnabled('CAP-PLAN-ATP') && this.auth.hasAnyRole([...ATP_ROLES]));
  protected readonly loading = signal(false);
  protected readonly result = signal<AtpResult | null>(null);
  protected readonly timeline = signal<AtpBucket[]>([]);
  protected readonly reserved = signal(0);
  protected readonly timelineColumns: ColumnDef[] = [
    { field: 'date', header: this.translate.instant('inventoryScreens.atp.weekOf'), width: '120px' },
    { field: 'cumulativeSupply', header: this.translate.instant('inventoryScreens.atp.supply'), align: 'right' },
    { field: 'cumulativeDemand', header: this.translate.instant('inventoryScreens.atp.demand'), align: 'right' },
    { field: 'netAvailable', header: this.translate.instant('inventoryScreens.atp.net'), align: 'right' },
  ];
  protected readonly timelineRowClass = (row: unknown) => ((row as AtpBucket).netAvailable < 0 ? 'atp-row--short' : '');
  protected readonly quantityControl = new FormControl<number | null>(1, [Validators.required, Validators.min(0.0001)]);

  constructor() {
    effect(() => {
      const partId = this.partId();
      if (!this.visible() || !partId) return;
      untracked(() => this.load(partId));
    });
  }

  private load(partId: number): void {
    this.loading.set(true);
    forkJoin([
      this.inventoryService.getAtp(partId, this.quantityControl.value ?? 1).pipe(catchError(() => of(null))),
      this.inventoryService.getAtpTimeline(partId).pipe(catchError(() => of<AtpBucket[]>([]))),
      this.inventoryService.getPartBins(partId).pipe(catchError(() => of<PartBinLocation[]>([]))),
    ]).subscribe(([atp, timeline, bins]) => {
      this.result.set(atp);
      this.timeline.set(timeline);
      this.reserved.set(bins.reduce((sum, b) => sum + b.reservedQuantity, 0));
      this.loading.set(false);
    });
  }

  protected check(): void {
    if (this.quantityControl.invalid) return;
    this.load(this.partId());
  }
}
