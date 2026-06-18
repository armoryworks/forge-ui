import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InventoryService } from '../services/inventory.service';
import { InventoryPartSummary } from '../models/inventory-part-summary.model';
import { LowStockAlert } from '../models/low-stock-alert.model';
import { StorageLocationFlat } from '../models/storage-location-flat.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../../shared/components/entity-picker/entity-picker.component';
import { QuickActionPanelComponent, QuickAction } from '../../../shared/components/quick-action-panel/quick-action-panel.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { CapDirective } from '../../../shared/directives/cap.directive';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { CapabilityService } from '../../../shared/services/capability.service';
import { ColumnDef } from '../../../shared/models/column-def.model';

type StockVerb = 'receive' | 'use' | 'count';
type HomeTab = 'kiosk' | 'tasks' | 'dashboard';

interface VerbDialogState {
  mode: StockVerb;
  partLabel?: string;
}

/**
 * The standalone-inventory home: a friendly, low-friction surface for a shop that
 * runs inventory on its own. Three tabs (Kiosk default, Tasks, Dashboard) over the
 * same data, reusing the friendly stock verbs. When the Locations sub-feature
 * (CAP-INV-MULTILOC) is off, the location field is hidden and the server places
 * everything in the default location.
 */
@Component({
  selector: 'app-inventory-home',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, TranslatePipe, RouterLink,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    EntityPickerComponent, QuickActionPanelComponent, DataTableComponent,
    ColumnCellDirective, EmptyStateComponent, LoadingBlockDirective,
    ValidationButtonComponent, CapDirective,
  ],
  templateUrl: './inventory-home.component.html',
  styleUrl: './inventory-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryHomeComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventory = inject(InventoryService);
  private readonly capabilities = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  // ── Tabs (URL is the source of truth) ──
  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') as HomeTab) ?? 'kiosk')),
    { initialValue: 'kiosk' as HomeTab },
  );

  protected readonly locationsEnabled = computed(() => this.capabilities.isEnabled('CAP-INV-MULTILOC'));

  // ── Data ──
  protected readonly parts = signal<InventoryPartSummary[]>([]);
  protected readonly lowStock = signal<LowStockAlert[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly searchControl = new FormControl('');
  private readonly search = toSignal(this.searchControl.valueChanges.pipe(map(v => (v ?? '').trim())), { initialValue: '' });

  protected readonly filteredParts = computed(() => {
    const term = this.search().toLowerCase();
    const all = this.parts();
    if (!term) return all;
    return all.filter(p =>
      (p.partNumber ?? '').toLowerCase().includes(term) ||
      (p.description ?? '').toLowerCase().includes(term));
  });

  protected readonly totalParts = computed(() => this.parts().length);
  protected readonly totalOnHand = computed(() => this.parts().reduce((sum, p) => sum + (p.onHand ?? 0), 0));
  protected readonly lowStockCount = computed(() => this.lowStock().length);

  protected readonly stockColumns: ColumnDef[] = [
    { field: 'partNumber', header: 'Part #', sortable: true, width: '140px' },
    { field: 'description', header: 'Description', sortable: true },
    { field: 'onHand', header: 'On hand', sortable: true, type: 'number', align: 'right', width: '110px' },
    { field: 'actions', header: '', sortable: false, align: 'right', width: '150px' },
  ];

  // ── Kiosk actions ──
  protected readonly kioskActions = computed<QuickAction[]>(() => {
    const actions: QuickAction[] = [
      { id: 'receive', label: this.translate.instant('inventory.home.verbs.receive'), icon: 'add_box', color: 'var(--success)' },
      { id: 'use', label: this.translate.instant('inventory.home.verbs.use'), icon: 'remove_circle_outline', color: 'var(--warning)' },
      { id: 'count', label: this.translate.instant('inventory.home.verbs.count'), icon: 'fact_check', color: 'var(--primary)' },
      { id: 'find', label: this.translate.instant('inventory.home.verbs.find'), icon: 'search', color: 'var(--info)' },
    ];
    return actions;
  });

  // ── Verb dialog ──
  protected readonly verbDialog = signal<VerbDialogState | null>(null);
  protected readonly verbForm = new FormGroup({
    partId: new FormControl<number | null>(null, Validators.required),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    locationId: new FormControl<number | null>(null),
    reason: new FormControl<string>(''),
    notes: new FormControl<string>(''),
    lotNumber: new FormControl<string>(''),
  });
  protected readonly verbViolations = FormValidationService.getViolations(this.verbForm, {
    partId: 'Part', quantity: 'Quantity',
  });

  protected readonly verbTitle = computed(() => {
    const mode = this.verbDialog()?.mode;
    return mode ? this.translate.instant(`inventory.home.dialog.${mode}Title`) : '';
  });

  protected readonly locationOptions = signal<SelectOption[]>([]);

  constructor() {
    // Load list data when a data tab is active (kiosk needs it for Find/dialog too).
    effect(() => {
      this.activeTab();
      this.loadData();
    });
  }

  private loadData(): void {
    this.loading.set(true);
    this.inventory.getPartInventory().subscribe({
      next: rows => { this.parts.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.inventory.getLowStockAlerts().subscribe({
      next: rows => this.lowStock.set(rows),
      error: () => { /* low-stock is best-effort */ },
    });
  }

  protected switchTab(tab: HomeTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected onKioskAction(actionId: string): void {
    if (actionId === 'find') {
      this.switchTab('tasks');
      return;
    }
    this.openVerb(actionId as StockVerb);
  }

  protected openVerb(mode: StockVerb, part?: InventoryPartSummary): void {
    this.verbForm.reset({ partId: part?.partId ?? null, quantity: null, locationId: null, reason: '', notes: '', lotNumber: '' });
    this.verbDialog.set({ mode, partLabel: part?.partNumber });
    if (this.locationsEnabled() && this.locationOptions().length === 0) {
      this.inventory.getBinLocations().subscribe({
        next: (locs: StorageLocationFlat[]) =>
          this.locationOptions.set(locs.map(l => ({ value: l.id, label: l.locationPath || l.name }))),
        error: () => { /* leave empty; server falls back to default */ },
      });
    }
  }

  protected closeVerb(): void {
    this.verbDialog.set(null);
  }

  protected submitVerb(): void {
    const state = this.verbDialog();
    if (!state || this.verbForm.invalid) return;
    const v = this.verbForm.getRawValue();
    const partId = v.partId!;
    const quantity = v.quantity!;
    const locationId = this.locationsEnabled() ? (v.locationId ?? undefined) : undefined;
    const reason = (v.reason ?? '').trim() || undefined;
    const notes = (v.notes ?? '').trim() || undefined;

    this.saving.set(true);
    const done = (key: string) => {
      this.saving.set(false);
      this.closeVerb();
      this.loadData();
      this.snackbar.success(this.translate.instant(key));
    };
    const fail = () => this.saving.set(false);

    switch (state.mode) {
      case 'receive':
        this.inventory.receiveStock({
          partId, quantity, locationId, reason, notes,
          lotNumber: (v.lotNumber ?? '').trim() || undefined,
        }).subscribe({ next: () => done('inventory.home.snackbar.received'), error: fail });
        break;
      case 'use':
        this.inventory.useStock({ partId, quantity, locationId, reason, notes })
          .subscribe({ next: () => done('inventory.home.snackbar.used'), error: fail });
        break;
      case 'count':
        this.inventory.setOnHandQuantity({
          partId, quantity, locationId,
          reason: reason ?? this.translate.instant('inventory.home.defaultReason.count'),
          notes,
        }).subscribe({ next: () => done('inventory.home.snackbar.counted'), error: fail });
        break;
    }
  }
}
