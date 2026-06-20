import { ChangeDetectionStrategy, Component, inject, input, signal, output, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { ShipmentService } from '../../services/shipment.service';
import { ShippingRate } from '../../models/shipping-rate.model';
import { ShippingLabel } from '../../models/shipping-label.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-shipping-rates-dialog',
  standalone: true,
  imports: [CurrencyPipe, DialogComponent, LoadingBlockDirective, TranslatePipe],
  templateUrl: './shipping-rates-dialog.component.html',
  styleUrl: './shipping-rates-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShippingRatesDialogComponent implements OnInit {
  private readonly shipmentService = inject(ShipmentService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly shipmentId = input.required<number>();
  readonly closed = output<void>();
  readonly labelCreated = output<ShippingLabel>();

  protected readonly rates = signal<ShippingRate[]>([]);
  protected readonly loadingRates = signal(false);
  protected readonly selectedRate = signal<ShippingRate | null>(null);
  protected readonly creatingLabel = signal(false);
  protected readonly createdLabel = signal<ShippingLabel | null>(null);
  // Surfaces the server's real reason (e.g. "Shipment has no shipping address assigned")
  // instead of a generic "No rates available", so the user knows what to fix.
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadRates();
  }

  private serverMessage(err: HttpErrorResponse, fallbackKey: string): string {
    return err.error?.detail ?? err.error?.title ?? this.translate.instant(fallbackKey);
  }

  private loadRates(): void {
    this.loadingRates.set(true);
    this.errorMessage.set(null);
    this.shipmentService.getRates(this.shipmentId()).pipe(
      catchError((err: HttpErrorResponse) => {
        this.errorMessage.set(this.serverMessage(err, 'shipments.failedRates'));
        return of([]);
      }),
    ).subscribe(rates => {
      this.rates.set(rates);
      this.loadingRates.set(false);
    });
  }

  protected selectRate(rate: ShippingRate): void {
    this.selectedRate.set(rate);
  }

  protected createLabel(): void {
    const rate = this.selectedRate();
    if (!rate) return;
    this.creatingLabel.set(true);
    this.errorMessage.set(null);
    this.shipmentService.createLabel(this.shipmentId(), rate.carrierId, rate.serviceName).pipe(
      catchError((err: HttpErrorResponse) => {
        this.errorMessage.set(this.serverMessage(err, 'shipments.failedLabel'));
        this.creatingLabel.set(false);
        return of(null);
      }),
    ).subscribe(label => {
      if (!label) return;
      this.createdLabel.set(label);
      this.creatingLabel.set(false);
      this.snackbar.success(this.translate.instant('shipments.labelCreatedSuccess'));
      this.labelCreated.emit(label);
    });
  }

  protected close(): void {
    this.closed.emit();
  }
}
