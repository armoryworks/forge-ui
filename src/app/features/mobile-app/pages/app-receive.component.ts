import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked, viewChildren } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';

import { firstValueFrom, map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PurchaseOrderDetail } from '../../purchase-orders/models/purchase-order-detail.model';
import { PurchaseOrderLine } from '../../purchase-orders/models/purchase-order-line.model';
import { EntityPickerComponent } from '../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { MobileReceiptLine } from '../../../shared/models/mobile-receipt-line.model';
import { MobileReceiptRequest } from '../../../shared/models/mobile-receipt-request.model';
import { CapabilityService } from '../../../shared/services/capability.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileReceivingService } from '../../../shared/services/mobile-receiving.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { IdentityPromptComponent } from '../identity/identity-prompt.component';

type LineForm = FormGroup<{
  quantity: FormControl<number | null>;
  binId: FormControl<number | null>;
  lot: FormControl<string>;
}>;

const RECEIVABLE_STATUSES = ['Submitted', 'Acknowledged', 'PartiallyReceived'];

/**
 * Receive: reached by scanning a PO at the dock. The PO header, its open
 * lines with what is still due, and per line a quantity, a bin and a lot /
 * heat number; one packing slip number for the whole receipt. Online only,
 * and a refusal shows the server's own message.
 */
@Component({
  selector: 'app-app-receive',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, EntityPickerComponent, IdentityPromptComponent],
  templateUrl: './app-receive.component.html',
  styleUrl: './app-receive.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppReceiveComponent {
  private readonly receiving = inject(MobileReceivingService);
  private readonly capabilities = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly identity = inject(SharedIdentityService);
  private readonly instances = inject(InstanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly poId = toSignal(
    this.route.paramMap.pipe(map((p) => Number(p.get('id')))), { initialValue: 0 });

  private readonly binPickers = viewChildren<EntityPickerComponent>('binPicker');

  protected readonly po = signal<PurchaseOrderDetail | null>(null);
  protected readonly binLabels = signal<(string | null)[]>([]);
  protected readonly binPickerFilters: Record<string, string> = { activeOnly: 'true' };
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly online = signal(navigator.onLine);
  protected readonly identifying = signal(false);

  protected readonly form = new FormGroup({
    packingSlip: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    lines: new FormArray<LineForm>([]),
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly binsEnabled = computed(() =>
    this.capabilities.isEnabled('CAP-INV-CORE') && this.capabilities.isEnabled('CAP-INV-MULTILOC'));

  protected readonly receivable = computed(() => RECEIVABLE_STATUSES.includes(this.po()?.status ?? ''));

  protected readonly lines = computed<PurchaseOrderLine[]>(() =>
    (this.po()?.lines ?? []).filter((l) => l.remainingQuantity > 0));

  protected readonly statusLabel = computed(() => {
    const status = this.po()?.status;
    if (!status) return '';
    const key = `purchaseOrders.status${status}`;
    const label = this.translate.instant(key);
    return label === key ? status : label;
  });

  protected readonly fullyReceived = computed(() =>
    this.po()?.status === 'Received' || (this.receivable() && this.lines().length === 0));

  protected readonly canSubmit = computed(() => {
    const value = this.formValue();
    const anyQuantity = (value.lines ?? []).some((l) => (l?.quantity ?? 0) > 0);
    return anyQuantity && this.form.valid && this.online() && !this.busy() && this.receivable();
  });

  constructor() {
    const onOnline = () => this.online.set(true);
    const onOffline = () => this.online.set(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    });
    effect(() => {
      const pickers = this.binPickers();
      untracked(() => this.syncBinPickers(pickers));
    });
    void this.load();
  }

  protected onBinSelected(index: number, entity: Record<string, unknown> | null): void {
    const path = entity?.['locationPath'];
    this.binLabels.update((labels) => labels.map((existing, i) => (i === index ? (typeof path === 'string' ? path : null) : existing)));
  }

  protected lineGroup(index: number): LineForm {
    return this.form.controls.lines.at(index);
  }

  protected fillRemaining(index: number): void {
    const line = this.lines()[index];
    if (line) this.lineGroup(index).controls.quantity.setValue(line.remainingQuantity);
  }

  protected back(): void {
    void this.router.navigateByUrl('/app/scan');
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    if (this.instances.instance()?.shared && !this.identity.identified()) {
      this.identifying.set(true);
      return;
    }
    void this.doReceive();
  }

  protected onIdentified(): void {
    this.identifying.set(false);
    void this.doReceive();
  }

  protected onIdentityCancelled(): void {
    this.identifying.set(false);
  }

  protected async load(): Promise<void> {
    const id = this.poId();
    if (!id) {
      this.loading.set(false);
      this.failed.set(true);
      return;
    }
    this.loading.set(true);
    this.failed.set(false);
    this.forbidden.set(false);
    try {
      const po = await firstValueFrom(this.receiving.purchaseOrder(id));
      this.po.set(po);
      this.buildForm();
    } catch (err) {
      this.failed.set(true);
      this.forbidden.set(err instanceof HttpErrorResponse && err.status === 403);
    } finally {
      this.loading.set(false);
    }
  }

  private buildForm(): void {
    const array = this.form.controls.lines;
    array.clear({ emitEvent: false });
    for (const line of this.lines()) {
      array.push(new FormGroup({
        quantity: new FormControl<number | null>(null, [Validators.min(0), Validators.max(line.remainingQuantity)]),
        binId: new FormControl<number | null>(line.partId ? line.partDefaultBinId : null),
        lot: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
      }), { emitEvent: false });
    }
    this.binLabels.set(this.lines().map((line) => (line.partId ? line.partDefaultBinPath : null)));
    this.form.controls.packingSlip.setValue('', { emitEvent: false });
    this.form.updateValueAndValidity();
  }

  private syncBinPickers(pickers: readonly EntityPickerComponent[]): void {
    const labels = this.binLabels();
    this.lines()
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => !!line.partId)
      .forEach(({ i }, pickerIndex) => {
        const picker = pickers[pickerIndex];
        if (!picker) return;
        const binId = this.lineGroup(i).controls.binId.value;
        const label = labels[i];
        if (binId == null) picker.clearSelected();
        else if (label) picker.setSelected(binId, label);
      });
  }

  private buildRequest(): MobileReceiptRequest {
    const stockBins = this.binsEnabled();
    const lines: MobileReceiptLine[] = [];
    this.lines().forEach((line, i) => {
      const value = this.lineGroup(i).getRawValue();
      const quantity = value.quantity ?? 0;
      if (quantity <= 0) return;
      const stocked = line.partId !== null;
      const lot = stocked ? value.lot.trim() : '';
      lines.push({
        lineId: line.id,
        quantity,
        storageLocationId: stocked && stockBins ? value.binId : null,
        lotNumber: lot || null,
      });
    });
    const slip = this.form.controls.packingSlip.value.trim();
    return { lines, packingSlipNumber: slip || null };
  }

  private async doReceive(): Promise<void> {
    const po = this.po();
    if (!po || this.busy()) return;
    const request = this.buildRequest();
    if (request.lines.length === 0) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.receiving.receive(po.id, request));
      this.snackbar.success(this.translate.instant('mobileReceive.received', { number: po.poNumber }));
      await this.load();
    } catch (err) {
      this.error.set(this.serverMessage(err) ?? this.translate.instant('mobileReceive.failed'));
    } finally {
      this.busy.set(false);
      this.identity.touch();
    }
  }

  private serverMessage(err: unknown): string | null {
    const body = (err as { error?: unknown } | null)?.error;
    if (!body) return null;
    if (typeof body === 'string') return body;
    if (typeof body !== 'object') return null;
    const problem = body as { detail?: unknown; title?: unknown; message?: unknown; errors?: unknown };
    if (typeof problem.detail === 'string' && problem.detail) return problem.detail;
    if (Array.isArray(problem.errors)) {
      const first = problem.errors[0] as { message?: unknown } | undefined;
      if (typeof first?.message === 'string' && first.message) return first.message;
    }
    if (typeof problem.message === 'string' && problem.message) return problem.message;
    if (typeof problem.title === 'string' && problem.title) return problem.title;
    return null;
  }
}
