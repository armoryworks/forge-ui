import {
  AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { firstValueFrom, map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { OnHand, ScanResolveResult } from '../../../shared/models/mobile-api.model';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { IdentityPromptComponent } from '../identity/identity-prompt.component';

type Step = 'part' | 'from' | 'to' | 'quantity';

/**
 * Move Stock: scan part → scan from-bin → scan to-bin → quantity on a
 * stepper (default = on hand at the from-bin) → Done. Four scans, one tap.
 * Lot picker appears only for lot-tracked parts. Undo moves it back.
 */
@Component({
  selector: 'app-app-move-stock',
  standalone: true,
  imports: [TranslatePipe, IdentityPromptComponent],
  templateUrl: './app-move-stock.component.html',
  styleUrl: './app-move-stock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppMoveStockComponent implements AfterViewInit, OnDestroy {
  private readonly scanner = inject(CameraScannerService);
  private readonly api = inject(MobileApiService);
  private readonly feedback = inject(ScanFeedbackService);
  private readonly undo = inject(UndoService);
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
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly cameraError = signal(false);
  protected readonly identifying = signal(false);

  protected readonly scanning = computed(() => this.step() !== 'quantity');
  protected readonly canFinish = computed(() =>
    this.quantity() > 0
    && (!this.onHand()?.lotTracked || !!this.lot())
    && (this.onHand() === null || this.quantity() <= this.lotQuantity()));

  private readonly lotQuantity = computed(() => {
    const stock = this.onHand();
    if (!stock) return Number.MAX_SAFE_INTEGER;
    const lot = this.lot();
    return lot ? (stock.lots.find((l) => l.lotNumber === lot)?.quantity ?? 0) : stock.quantity;
  });

  async ngAfterViewInit(): Promise<void> {
    const code = this.prefillCode();
    if (code) await this.accept(code);
    if (this.scanning()) await this.startScanner();
  }

  async ngOnDestroy(): Promise<void> {
    await this.scanner.stop();
  }

  protected bump(delta: number): void {
    this.quantity.set(Math.max(1, Math.min(this.lotQuantity(), this.quantity() + delta)));
  }

  protected pickLot(lotNumber: string): void {
    this.lot.set(lotNumber);
    const stock = this.onHand();
    const qty = stock?.lots.find((l) => l.lotNumber === lotNumber)?.quantity ?? 1;
    this.quantity.set(Math.max(1, Math.floor(qty)));
  }

  protected restart(): void {
    this.part.set(null); this.from.set(null); this.to.set(null);
    this.onHand.set(null); this.lot.set(null); this.quantity.set(1); this.notice.set(null);
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
      this.undo.offer(
        this.translate.instant('mobileApp.move.done', {
          qty: result.quantity, part: result.partNumber, to: result.toLocationName,
        }),
        () => firstValueFrom(this.api.moveStock(result.undo)),
      );
      this.restart();
    } catch {
      this.snackbar.error(this.translate.instant('mobileApp.move.failed'));
    } finally {
      this.busy.set(false);
      this.identity.touch();
    }
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
      const expected = this.step() === 'part' ? 'part' : 'bin';
      if (resolved.kind !== expected) {
        await this.feedback.doubleBuzz();
        this.notice.set(this.translate.instant(`mobileApp.move.expect.${expected}`));
        return;
      }
      await this.feedback.tick();
      this.notice.set(null);

      if (this.step() === 'part') {
        this.part.set(resolved);
        this.step.set('from');
      } else if (this.step() === 'from') {
        this.from.set(resolved);
        this.step.set('to');
      } else {
        if (resolved.id === this.from()?.id) {
          await this.feedback.doubleBuzz();
          this.notice.set(this.translate.instant('mobileApp.move.sameBin'));
          return;
        }
        this.to.set(resolved);
        await this.scanner.stop();
        const stock = await firstValueFrom(this.api.onHand(this.part()!.id!, this.from()!.id!));
        this.onHand.set(stock);
        this.quantity.set(Math.max(1, Math.floor(stock.quantity)));
        if (stock.lotTracked && stock.lots.length === 1) this.pickLot(stock.lots[0].lotNumber);
        this.step.set('quantity');
      }
    } catch {
      await this.feedback.doubleBuzz();
      this.notice.set(this.translate.instant('mobileApp.scan.lookupFailed'));
    } finally {
      this.busy.set(false);
    }
  }
}
