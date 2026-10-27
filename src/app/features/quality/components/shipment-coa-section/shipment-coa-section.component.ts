import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CoaService } from '../../services/coa.service';
import { CertificateOfAnalysis } from '../../models/certificate-of-analysis.model';
import { CoaAttachWarning } from '../../models/coa-attach-warning.model';
import { COA_CAPABILITY, COA_SHIPMENT_ROLES } from '../../models/coa-roles.model';
import { CoaListComponent } from '../coa-list/coa-list.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

@Component({
  selector: 'app-shipment-coa-section',
  standalone: true,
  imports: [TranslatePipe, CoaListComponent],
  templateUrl: './shipment-coa-section.component.html',
  styleUrl: './shipment-coa-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentCoaSectionComponent {
  private readonly coaService = inject(CoaService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly shipmentId = input.required<number>();
  readonly shipped = input(false);

  protected readonly visible = computed(() =>
    this.capabilities.isEnabled(COA_CAPABILITY) && this.auth.hasAnyRole(COA_SHIPMENT_ROLES));
  protected readonly certificates = signal<CertificateOfAnalysis[]>([]);
  protected readonly warnings = signal<CoaAttachWarning[]>([]);
  protected readonly attaching = signal(false);

  constructor() {
    effect(() => {
      const id = this.shipmentId();
      if (id && this.visible()) this.load(id);
    });
  }

  private load(shipmentId: number): void {
    this.coaService.list({ shipmentId }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => this.certificates.set(list),
    });
  }

  protected attach(): void {
    if (this.attaching()) return;
    this.attaching.set(true);
    this.coaService.attachToShipment(this.shipmentId()).subscribe({
      next: result => {
        this.attaching.set(false);
        this.certificates.set(result.attached);
        this.warnings.set(result.warnings);
        if (result.warnings.length > 0) {
          this.snackbar.warn(this.translate.instant('coa.attachWarnings', { count: result.warnings.length }));
        } else if (result.attached.length === 0) {
          this.snackbar.info(this.translate.instant('coa.nothingToAttach'));
        } else {
          this.snackbar.success(this.translate.instant('coa.attached', { count: result.attached.length }));
        }
      },
      error: (err: unknown) => {
        this.attaching.set(false);
        this.snackbar.errorFrom(err, 'coa.attachFailed');
      },
    });
  }

  protected warningKey(warning: CoaAttachWarning): string {
    return warning.code === 'coa-nonconforming' ? 'coa.warningNonConforming' : 'coa.warningNoResults';
  }
}
