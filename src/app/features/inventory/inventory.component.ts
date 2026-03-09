import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { InventoryService } from './services/inventory.service';
import {
  StorageLocation,
  InventoryPartSummary,
  BinContentItem,
  BinMovementItem,
  LocationType,
} from './models/inventory.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../shared/services/form-validation.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, PageHeaderComponent, DialogComponent, InputComponent, SelectComponent, ValidationPopoverDirective],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryComponent {
  private readonly inventoryService = inject(InventoryService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly activeTab = signal<'stock' | 'locations' | 'movements'>('stock');

  // Stock tab
  protected readonly partSummaries = signal<InventoryPartSummary[]>([]);
  protected readonly searchControl = new FormControl('');
  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });
  protected readonly expandedPartId = signal<number | null>(null);

  // Locations tab
  protected readonly locationTree = signal<StorageLocation[]>([]);
  protected readonly selectedLocation = signal<StorageLocation | null>(null);
  protected readonly binContents = signal<BinContentItem[]>([]);
  protected readonly expandedLocationIds = signal<Set<number>>(new Set());

  // Movements tab
  protected readonly movements = signal<BinMovementItem[]>([]);

  // Location dialog
  protected readonly showLocationDialog = signal(false);
  protected readonly locationForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    locationType: new FormControl<LocationType>('Area', [Validators.required]),
    parentId: new FormControl<number | null>(null),
    barcode: new FormControl(''),
    description: new FormControl(''),
  });

  protected readonly locationViolations = FormValidationService.getViolations(this.locationForm, {
    name: 'Name',
    locationType: 'Type',
  });

  protected readonly locationTypes: LocationType[] = ['Area', 'Rack', 'Shelf', 'Bin'];
  protected readonly locationTypeOptions: SelectOption[] = this.locationTypes.map(t => ({ value: t, label: t }));

  constructor() {
    this.loadStock();
  }

  protected switchTab(tab: 'stock' | 'locations' | 'movements'): void {
    this.activeTab.set(tab);
    if (tab === 'stock' && this.partSummaries().length === 0) this.loadStock();
    if (tab === 'locations' && this.locationTree().length === 0) this.loadLocations();
    if (tab === 'movements' && this.movements().length === 0) this.loadMovements();
  }

  // ── Stock Tab ──

  protected loadStock(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    this.inventoryService.getPartInventory(search).subscribe({
      next: (data) => { this.partSummaries.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applySearch(): void {
    this.loadStock();
  }

  protected clearSearch(): void {
    this.searchControl.setValue('');
    this.loadStock();
  }

  protected togglePartExpand(partId: number): void {
    this.expandedPartId.set(this.expandedPartId() === partId ? null : partId);
  }

  protected getStockClass(summary: InventoryPartSummary): string {
    if (summary.available <= 0) return 'stock-level--empty';
    if (summary.available < summary.onHand * 0.2) return 'stock-level--low';
    return '';
  }

  // ── Locations Tab ──

  protected loadLocations(): void {
    this.loading.set(true);
    this.inventoryService.getLocationTree().subscribe({
      next: (data) => { this.locationTree.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected toggleLocationExpand(locationId: number): void {
    const ids = new Set(this.expandedLocationIds());
    if (ids.has(locationId)) {
      ids.delete(locationId);
    } else {
      ids.add(locationId);
    }
    this.expandedLocationIds.set(ids);
  }

  protected isLocationExpanded(locationId: number): boolean {
    return this.expandedLocationIds().has(locationId);
  }

  protected selectLocation(location: StorageLocation): void {
    this.selectedLocation.set(location);
    if (location.locationType === 'Bin') {
      this.inventoryService.getBinContents(location.id).subscribe({
        next: (data) => this.binContents.set(data),
      });
    } else {
      this.binContents.set([]);
    }
  }

  protected getLocationIcon(type: LocationType): string {
    switch (type) {
      case 'Area': return 'warehouse';
      case 'Rack': return 'view_column';
      case 'Shelf': return 'shelves';
      case 'Bin': return 'inventory_2';
    }
  }

  protected openCreateLocation(parentId?: number): void {
    this.locationForm.reset({
      name: '', locationType: parentId ? 'Rack' : 'Area',
      parentId: parentId ?? null, barcode: '', description: '',
    });
    this.showLocationDialog.set(true);
  }

  protected closeLocationDialog(): void {
    this.showLocationDialog.set(false);
  }

  protected saveLocation(): void {
    if (this.locationForm.invalid) return;

    this.saving.set(true);
    const form = this.locationForm.getRawValue();
    this.inventoryService.createLocation({
      name: form.name!,
      locationType: form.locationType!,
      parentId: form.parentId ?? undefined,
      barcode: form.barcode || undefined,
      description: form.description || undefined,
    }).subscribe({
      next: () => { this.saving.set(false); this.closeLocationDialog(); this.loadLocations(); },
      error: () => this.saving.set(false),
    });
  }

  // ── Movements Tab ──

  protected loadMovements(): void {
    this.loading.set(true);
    this.inventoryService.getMovements().subscribe({
      next: (data) => { this.movements.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected getReasonLabel(reason: string | null): string {
    if (!reason) return '—';
    const labels: Record<string, string> = {
      Receive: 'Received', Pick: 'Picked', Restock: 'Restocked',
      QcRelease: 'QC Released', Ship: 'Shipped', Move: 'Moved',
      Adjustment: 'Adjusted', Return: 'Returned',
    };
    return labels[reason] ?? reason;
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Reserved: 'chip--primary', ReadyToShip: 'chip--success', QcHold: 'chip--warning',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      Stored: 'Stored', Reserved: 'Reserved',
      ReadyToShip: 'Ready to Ship', QcHold: 'QC Hold',
    };
    return labels[status] ?? status;
  }
}
