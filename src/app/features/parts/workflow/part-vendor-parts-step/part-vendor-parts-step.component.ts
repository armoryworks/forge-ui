import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { VendorPartFormDialogComponent, VendorPartFormDialogData } from '../../components/vendor-parts-cluster/vendor-part-form-dialog.component';
import { VendorPartListPanelComponent } from '../../components/vendor-parts-cluster/vendor-part-list-panel.component';
import { VendorPartPriceTierHistoryDialogComponent, VendorPartPriceTierHistoryDialogData } from '../../components/vendor-parts-cluster/vendor-part-price-tier-history-dialog.component';
import { VendorPartPriceTiersDialogComponent, VendorPartPriceTiersDialogData } from '../../components/vendor-parts-cluster/vendor-part-price-tiers-dialog.component';
import { PartDetail } from '../../models/part-detail.model';
import { VendorPart } from '../../models/vendor-part.model';
import { VendorPartsService } from '../../services/vendor-parts.service';

/**
 * Part workflow step that lets the user manage VendorPart rows for the
 * part being edited. Each VendorPart carries the OEM identity that used
 * to live on Part itself (manufacturer name, manufacturer PN, vendor SKU)
 * plus per-vendor sourcing terms (lead time / MOQ / pack size / pricing).
 *
 * Inserted into the Buy* and Subcontract* workflow definitions right
 * after the preferred-vendor selection step. Make / Phantom combos do not
 * include this step.
 *
 * Reuses the existing <app-vendor-part-list-panel> + dialog stack from
 * the Part detail page — this step is a thin orchestrator that loads
 * the rows for the entity, opens the dialogs, and refreshes on close.
 */
@Component({
  selector: 'app-part-vendor-parts-step',
  standalone: true,
  imports: [TranslatePipe, VendorPartListPanelComponent, LoadingBlockDirective],
  templateUrl: './part-vendor-parts-step.component.html',
  styleUrl: './part-vendor-parts-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartVendorPartsStepComponent {
  private readonly vendorPartsService = inject(VendorPartsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly stepId = input<string>('vendorParts');
  readonly componentName = input<string>('PartVendorPartsStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly vendorParts = signal<VendorPart[]>([]);
  protected readonly loading = signal(false);

  protected readonly part = computed<PartDetail | null>(() => (this.entity() as PartDetail | null) ?? null);

  constructor() {
    effect(() => {
      const id = this.entityId();
      if (id == null) {
        this.vendorParts.set([]);
        return;
      }
      this.load(id);
    });
  }

  private load(partId: number): void {
    this.loading.set(true);
    this.vendorPartsService.listForPart(partId).subscribe({
      next: (list) => {
        const sorted = [...list].sort((a, b) => {
          if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
          if (a.isApproved !== b.isApproved) return a.isApproved ? -1 : 1;
          return a.vendorCompanyName.localeCompare(b.vendorCompanyName);
        });
        this.vendorParts.set(sorted);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onAdd(): void {
    const p = this.part();
    if (!p) return;
    // First-vendor shortcut: dialog defaults preferred=true when this is
    // the part's only source. Preference becomes a real decision only once
    // an alternate exists.
    const isFirstSource = this.vendorParts().length === 0;
    this.dialog.open<
      VendorPartFormDialogComponent,
      VendorPartFormDialogData,
      VendorPart | null
    >(VendorPartFormDialogComponent, {
      width: '600px',
      data: {
        vendorPart: null,
        parentEntityType: 'part',
        parentEntityId: p.id,
        parentLabel: `${p.partNumber} — ${p.name}`,
        defaultIsPreferred: isFirstSource,
      },
    }).afterClosed().subscribe(result => {
      if (result) this.load(p.id);
    });
  }

  protected onEdit(vp: VendorPart): void {
    const p = this.part();
    if (!p) return;
    this.dialog.open<
      VendorPartFormDialogComponent,
      VendorPartFormDialogData,
      VendorPart | null
    >(VendorPartFormDialogComponent, {
      width: '600px',
      data: {
        vendorPart: vp,
        parentEntityType: 'part',
        parentEntityId: p.id,
      },
    }).afterClosed().subscribe(result => {
      if (result) this.load(p.id);
    });
  }

  protected onDelete(vp: VendorPart): void {
    const p = this.part();
    if (!p) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('vendorPart.removeVendor'),
        message: this.translate.instant('vendorPart.confirmDelete'),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.vendorPartsService.delete(vp.id).subscribe({
        next: () => {
          this.snackbar.success('Vendor source removed');
          this.load(p.id);
        },
      });
    });
  }

  protected onTogglePreferred(vp: VendorPart): void {
    const p = this.part();
    if (!p) return;
    this.vendorPartsService.update(vp.id, { isPreferred: !vp.isPreferred }).subscribe({
      next: () => this.load(p.id),
    });
  }

  protected onViewTiers(vp: VendorPart): void {
    const p = this.part();
    if (!p) return;
    this.dialog.open<
      VendorPartPriceTiersDialogComponent,
      VendorPartPriceTiersDialogData
    >(VendorPartPriceTiersDialogComponent, {
      width: '700px',
      data: { vendorPart: vp },
    }).afterClosed().subscribe(() => this.load(p.id));
  }

  protected onViewTierHistory(vp: VendorPart): void {
    this.dialog.open<
      VendorPartPriceTierHistoryDialogComponent,
      VendorPartPriceTierHistoryDialogData
    >(VendorPartPriceTierHistoryDialogComponent, {
      width: '700px',
      data: { vendorPart: vp },
    });
  }
}
