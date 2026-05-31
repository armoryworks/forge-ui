import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap, tap } from 'rxjs';

import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { Address } from '../../../../shared/models/address.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { fromAddressToVendor } from '../../../../shared/utils/address.utils';

import { VendorDetail } from '../../models/vendor-detail.model';
import { VendorService } from '../../services/vendor.service';

/**
 * Vendor workflow address step. Optional — no completion gate; admins can
 * skip and fill the address later from the vendor detail page. Wraps the
 * shared AddressFormComponent (CVA) so the single FormControl roundtrips
 * the full {line1, city, state, postalCode, country} bag through one input.
 */
@Component({
  selector: 'app-vendor-address-step',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, AddressFormComponent, LoadingBlockDirective],
  templateUrl: './vendor-address-step.component.html',
  styleUrl: './vendor-address-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorAddressStepComponent {
  private readonly vendorService = inject(VendorService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('address');
  readonly componentName = input<string>('VendorAddressStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    address: new FormControl<Address | null>(null),
  });

  constructor() {
    effect(() => {
      const vendor = this.entity() as VendorDetail | null;
      if (!vendor) return;
      // Hydrate the address CVA from the vendor's flat address columns.
      const seed: Address | null = (vendor.address || vendor.city || vendor.state || vendor.zipCode || vendor.country)
        ? {
            line1: vendor.address ?? '',
            line2: '',
            city: vendor.city ?? '',
            state: vendor.state ?? '',
            postalCode: vendor.zipCode ?? '',
            country: vendor.country ?? '',
          }
        : null;
      this.form.patchValue({ address: seed }, { emitEvent: false });
    });

    this.workflowService.registerStepForm(
      this.form,
      { address: this.translate.instant('vendors.workflow.address.label') },
      () => this.save(),
    );
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  private save(): Observable<unknown> {
    const runId = this.runId();
    if (runId == null) return of(null);
    if (this.form.pristine) return of(null);
    const value = this.form.getRawValue();
    this.saving.set(true);
    return this.workflowService.patchStep(runId, this.stepId(), {
      ...fromAddressToVendor(value.address),
    }).pipe(
      switchMap((run) => {
        if (run.entityId == null) return of(null);
        return this.vendorService.getVendorById(run.entityId).pipe(
          tap((vendor) => this.workflowService.currentEntity.set(vendor)),
        );
      }),
      tap({
        next: () => {
          this.saving.set(false);
          this.form.markAsPristine();
        },
        error: () => {
          this.saving.set(false);
          this.snackbar.error(this.translate.instant('vendors.workflow.address.saveFailed'));
        },
      }),
    );
  }
}
