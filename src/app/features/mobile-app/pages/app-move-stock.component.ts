import {
  AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { firstValueFrom, map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../shared/components/input/input.component';
import { OnHand, ScanResolveResult, isQueued } from '../../../shared/models/mobile-api.model';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { wasHttpErrorShown } from '../../../shared/utils/shown-http-errors';
import { ManualCodeEntryComponent } from '../components/manual-code-entry/manual-code-entry.component';
import { IdentityPromptComponent } from '../identity/identity-prompt.component';

type Step = 'part' | 'from' | 'to' | 'quantity';

/**
 * Move Stock: scan part → scan from-bin → scan to-bin → quantity on a
 * stepper (default = on hand at the from-bin), or typed → Done. Four scans,
 * one tap. A from-bin that does not hold the part is refused at once. Lot
 * picker appears only for lot-tracked parts, with a "no lot" choice for stock
 * put away without one. Moves are in whole units; a fraction on hand stays
 * behind and the screen says so. A typed quantity is held to 1..what can
 * move. Scanning a lot first picks its part and that lot; scanning a bin
 * first makes it the from-bin, checked once the part is scanned. A refusal
 * the server already explained is not repeated. Undo moves it back.
 */
@Component({
  selector: 'app-app-move-stock',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, IdentityPromptComponent, ManualCodeEntryComponent],
  templateUrl: './app-move-stock.component.html',
  styleUrl: './app-move-stock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppMoveStockComponent implements AfterViewInit, OnDestroy {
  private readonly scanner = inject(CameraScannerService);
  private readonly api = inject(MobileApiService);
  private readonly feedback = inject(ScanFeedbackService);
  private readonly undo = inject(UndoService);
  private readonly queue = inject(OfflineQueueService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly identity = inject(SharedIdentityService);
  private readonly instances = inject(InstanceService);
  private readonly route = inject(ActivatedRoute);

  private readonly prefillCode = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('code'))), { initialValue: null });

  protected readonly step = signal<Step>('part');
  protected readonly part = signal<ScanResolveResult | null>(null);
  protected readonly from = signal<ScanResolveResult | null>(null);
  protected readonly to = signal<ScanResolveResult | null>(null);
  protected readonly onHand = signal<OnHand | null>(null);
  protected readonly quantity = signal(1);
  protected readonly lot = signal<string | null>(null);
  protected readonly noLot = signal(false);
  protected readonly typingQuantity = signal(false);
  protected readonly typedQuantity = new FormControl<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly cameraError = signal(false);
  protected readonly identifying = signal(false);
  protected readonly typing = signal(false);

  private prefillLot: string | null = null;

  protected readonly scanning = computed(() => this.step() !== 'quantity');
  protected readonly canFinish = computed(() =>
    this.quantity() > 0
    && this.wholeQuantity()
    && (!this.onHand()?.lotTracked || !!this.lot() || this.noLot())
    && (this.onHand() === null || this.quantity() <= this.movable()));

  private readonly available = computed(() => {
    const stock = this.onHand();
    if (!stock) return Number.MAX_SAFE_INTEGER;
    const lot = this.lot();
    if (lot) return stock.lots.find((l) => l.lotNumber === lot)?.quantity ?? 0;
    return stock.lotTracked ? stock.unlottedQuantity : stock.quantity;
  });

  protected readonly movable = computed(() => Math.floor(this.available()));
  protected readonly wholeQuantity = computed(() => Number.isInteger(this.quantity()));

  protected readonly leftBehind = computed(() => {
    if (!this.onHand() || (this.onHand()!.lotTracked && !this.lot() && !this.noLot())) return null;
    const rest = Math.round((this.available() - this.movable()) * 1e6) / 1e6;
    return rest > 0 ? rest : null;
  });

  constructor() {
    this.typedQuantity.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value === null || !Number.isFinite(value)) return;
      const held = Math.max(1, Math.min(this.movable(), value));
      if (held !== value) this.setQuantity(held);
      else this.quantity.set(value);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const code = this.prefillCode();
    if (code) await this.accept(code);
    if (this.scanning()) await this.startScanner();
  }

  async ngOnDestroy(): Promise<void> {
    await this.scanner.stop();
  }

  protected openManual(): void {
    this.typing.set(true);
  }

  protected closeManual(): void {
    this.typing.set(false);
  }

  protected async submitManual(code: string): Promise<void> {
    this.typing.set(false);
    await this.accept(code);
  }

  protected bump(delta: number): void {
    this.setQuantity(Math.max(1, Math.min(this.movable(), Math.floor(this.quantity()) + delta)));
  }

  protected typeQuantity(): void {
    this.typedQuantity.setValue(this.quantity(), { emitEvent: false });
    this.typingQuantity.set(true);
  }

  protected pickLot(lotNumber: string): void {
    this.lot.set(lotNumber);
    this.noLot.set(false);
    this.setQuantity(this.movable());
  }

  protected pickNoLot(): void {
    this.lot.set(null);
    this.noLot.set(true);
    this.setQuantity(this.movable());
  }

  protected restart(): void {
    this.part.set(null); this.from.set(null); this.to.set(null);
    this.onHand.set(null); this.lot.set(null); this.noLot.set(false); this.notice.set(null);
    this.prefillLot = null;
    this.typingQuantity.set(false);
    this.setQuantity(1);
    this.step.set('part');
    void this.startScanner();
  }

  protected finish(): void {
    if (this.instances.instance()?.shared && !this.identity.identified()) {
      this.identifying.set(true);
      return;
    }
    void this.doMove();
  }

  protected onIdentified(): void {
    this.identifying.set(false);
    void this.doMove();
  }

  protected onIdentityCancelled(): void {
    this.identifying.set(false);
  }

  private async doMove(): Promise<void> {
    const part = this.part(), from = this.from(), to = this.to();
    if (!part?.id || !from?.id || !to?.id || this.busy()) return;
    this.busy.set(true);
    try {
      const result = await firstValueFrom(this.api.moveStock({
        partId: part.id, fromLocationId: from.id, toLocationId: to.id,
        quantity: this.quantity(), lotNumber: this.lot(),
      }));
      if (isQueued(result)) {
        this.undo.offer(this.translate.instant('mobileApp.offline.queued'), () => this.queue.remove(result.entryId));
      } else {
        this.undo.offer(
          this.translate.instant('mobileApp.move.done', {
            qty: result.quantity, part: result.partNumber, to: result.toLocationName,
          }),
          () => firstValueFrom(this.api.moveStock(result.undo)),
        );
      }
      this.restart();
    } catch (err) {
      if (!wasHttpErrorShown(err)) this.snackbar.error(this.translate.instant('mobileApp.move.failed'));
    } finally {
      this.busy.set(false);
      this.identity.touch();
    }
  }

  private setQuantity(value: number): void {
    this.quantity.set(value);
    this.typedQuantity.setValue(value, { emitEvent: false });
  }

  private async startScanner(): Promise<void> {
    this.cameraError.set(false);
    try {
      await this.scanner.start('move-stock-viewfinder', (value) => void this.accept(value));
    } catch {
      this.cameraError.set(true);
    }
  }

  private async accept(code: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const resolved = await firstValueFrom(this.api.resolveScan(code));
      if (this.step() === 'part') {
        await this.acceptFirst(resolved);
        return;
      }
      if (resolved.kind !== 'bin') {
        await this.feedback.doubleBuzz();
        this.notice.set(this.translate.instant('mobileApp.move.expect.bin'));
        return;
      }
      await this.feedback.tick();
      this.notice.set(null);

      if (this.step() === 'from') {
        await this.takeFrom(resolved);
      } else {
        if (resolved.id === this.from()?.id) {
          await this.feedback.doubleBuzz();
          this.notice.set(this.translate.instant('mobileApp.move.sameBin'));
          return;
        }
        this.to.set(resolved);
        await this.scanner.stop();
        const stock = this.onHand()!;
        const prefill = this.prefillLot;
        if (prefill && stock.lots.some((l) => l.lotNumber === prefill)) this.pickLot(prefill);
        else if (stock.lotTracked && stock.lots.length === 1 && stock.unlottedQuantity <= 0) this.pickLot(stock.lots[0].lotNumber);
        else if (stock.lotTracked && stock.lots.length === 0 && stock.unlottedQuantity > 0) this.pickNoLot();
        else this.setQuantity(this.movable());
        this.step.set('quantity');
      }
    } catch {
      await this.feedback.doubleBuzz();
      this.notice.set(this.translate.instant('mobileApp.scan.lookupFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  private async acceptFirst(resolved: ScanResolveResult): Promise<void> {
    if (resolved.kind === 'bin' && resolved.id) {
      await this.feedback.tick();
      this.notice.set(null);
      this.from.set(resolved);
      return;
    }
    const part = this.partOf(resolved);
    if (!part) {
      await this.feedback.doubleBuzz();
      this.notice.set(this.translate.instant('mobileApp.move.expect.part'));
      return;
    }
    await this.feedback.tick();
    this.notice.set(null);
    this.part.set(part);
    this.prefillLot = resolved.kind === 'lot' ? resolved.label : null;
    const from = this.from();
    if (from) await this.takeFrom(from);
    else this.step.set('from');
  }

  private partOf(resolved: ScanResolveResult): ScanResolveResult | null {
    if (resolved.kind === 'part' && resolved.id) return resolved;
    if (resolved.kind === 'lot' && resolved.partId && resolved.partNumber) {
      return { kind: 'part', id: resolved.partId, code: resolved.partNumber, label: resolved.partNumber, subtitle: null };
    }
    return null;
  }

  private async takeFrom(bin: ScanResolveResult): Promise<void> {
    const stock = await firstValueFrom(this.api.onHand(this.part()!.id!, bin.id!));
    if (stock.quantity <= 0) {
      await this.feedback.doubleBuzz();
      this.notice.set(this.translate.instant('mobileApp.move.notInBin', { part: this.part()!.label, bin: bin.label }));
      this.from.set(null);
      this.step.set('from');
      return;
    }
    this.from.set(bin);
    this.onHand.set(stock);
    this.step.set('to');
  }
}
