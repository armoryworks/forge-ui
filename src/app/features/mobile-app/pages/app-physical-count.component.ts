import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PhysicalInventory } from '../../inventory/physical-inventory/models/physical-inventory.model';
import { PhysicalInventoryTag } from '../../inventory/physical-inventory/models/physical-inventory-tag.model';
import { InputComponent } from '../../../shared/components/input/input.component';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { MobilePhysicalCountService } from '../../../shared/services/mobile-physical-count.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';

/**
 * Physical count on the phone: pick the count in progress (picked for you when there is one), scan or type a tag
 * number, enter what is there, save, next tag. A blind count never shows the book quantity; a count outside the
 * recount tolerance says so and the same tag takes the recount.
 */
@Component({
  selector: 'app-app-physical-count',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent],
  templateUrl: './app-physical-count.component.html',
  styleUrl: './app-physical-count.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppPhysicalCountComponent implements OnDestroy {
  private readonly api = inject(MobilePhysicalCountService);
  private readonly scanner = inject(CameraScannerService);
  private readonly feedback = inject(ScanFeedbackService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(true);
  protected readonly inventories = signal<PhysicalInventory[]>([]);
  protected readonly inventory = signal<PhysicalInventory | null>(null);
  protected readonly tag = signal<PhysicalInventoryTag | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly scanning = signal(false);
  protected readonly lastSaved = signal<PhysicalInventoryTag | null>(null);

  protected readonly tagNumberControl = new FormControl<number | null>(null, [Validators.min(1)]);
  protected readonly quantityControl = new FormControl<number | null>(null, [Validators.required, Validators.min(0)]);

  protected readonly isRecount = computed(() => {
    const status = this.tag()?.status;
    return status === 'RecountRequired' || status === 'Recounted';
  });

  constructor() {
    void this.loadInventories();
  }

  async ngOnDestroy(): Promise<void> {
    await this.scanner.stop();
  }

  private async loadInventories(): Promise<void> {
    this.loading.set(true);
    try {
      const all = await firstValueFrom(this.api.counting());
      const open = all.filter(i => i.status === 'Frozen' || i.status === 'Counting');
      this.inventories.set(open);
      if (open.length === 1) this.inventory.set(open[0]);
    } catch {
      this.notice.set(this.translate.instant('mobileApp.physicalCount.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  protected choose(inventory: PhysicalInventory): void {
    this.inventory.set(inventory);
    this.tag.set(null);
    this.notice.set(null);
  }

  protected async lookUp(): Promise<void> {
    const number = this.tagNumberControl.value;
    if (!number) return;
    await this.open(number);
  }

  protected async startScan(): Promise<void> {
    this.scanning.set(true);
    try {
      await this.scanner.start('physical-count-viewfinder', value => void this.onScan(value));
    } catch {
      this.scanning.set(false);
      this.notice.set(this.translate.instant('mobileApp.physicalCount.cameraFailed'));
    }
  }

  private async onScan(value: string): Promise<void> {
    await this.scanner.stop();
    this.scanning.set(false);
    const digits = value.trim().split(/[^0-9]+/).filter(Boolean).pop();
    const number = digits ? Number(digits) : NaN;
    if (!Number.isInteger(number) || number < 1) {
      void this.feedback.doubleBuzz();
      this.notice.set(this.translate.instant('mobileApp.physicalCount.notATag', { code: value }));
      return;
    }
    void this.feedback.tick();
    this.tagNumberControl.setValue(number);
    await this.open(number);
  }

  private async open(tagNumber: number): Promise<void> {
    const inventory = this.inventory();
    if (!inventory) return;
    this.busy.set(true);
    this.notice.set(null);
    try {
      const tag = await firstValueFrom(this.api.tag(inventory.id, tagNumber));
      this.tag.set(tag);
      this.quantityControl.reset(tag.status === 'Counted' ? tag.countedQuantity : null);
    } catch (err) {
      this.tag.set(null);
      this.notice.set(this.message(err, 'mobileApp.physicalCount.tagNotFound', { tag: tagNumber }));
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    const inventory = this.inventory();
    const tag = this.tag();
    const quantity = this.quantityControl.value;
    if (!inventory || !tag || quantity === null || this.quantityControl.invalid) return;
    this.busy.set(true);
    try {
      const saved = await firstValueFrom(this.api.count(inventory.id, tag.id, quantity));
      this.lastSaved.set(saved);
      if (saved.status === 'RecountRequired') {
        this.tag.set(saved);
        this.quantityControl.reset(null);
        this.notice.set(this.translate.instant('mobileApp.physicalCount.recountAsked', { tag: saved.tagNumber }));
      } else {
        this.tag.set(null);
        this.tagNumberControl.reset(null);
        this.quantityControl.reset(null);
        this.notice.set(this.translate.instant('mobileApp.physicalCount.saved', { tag: saved.tagNumber }));
      }
    } catch (err) {
      this.notice.set(this.message(err, 'mobileApp.physicalCount.saveFailed', {}));
    } finally {
      this.busy.set(false);
    }
  }

  private message(err: unknown, fallbackKey: string, params: Record<string, unknown>): string {
    const detail = err instanceof HttpErrorResponse ? (err.error as { detail?: string } | null)?.detail : null;
    return detail ?? this.translate.instant(fallbackKey, params);
  }
}
