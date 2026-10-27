import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CoaService } from '../../services/coa.service';
import { CertificateOfAnalysis } from '../../models/certificate-of-analysis.model';
import { COA_CAPABILITY, COA_QUALITY_ROLES, COA_READ_ROLES } from '../../models/coa-roles.model';
import { CoaListComponent } from '../coa-list/coa-list.component';
import { GenerateCoaDialogComponent, GenerateCoaDialogData } from '../generate-coa-dialog/generate-coa-dialog.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-lot-coa-section',
  standalone: true,
  imports: [TranslatePipe, CoaListComponent],
  templateUrl: './lot-coa-section.component.html',
  styleUrl: './lot-coa-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LotCoaSectionComponent {
  private readonly coaService = inject(CoaService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lotId = input.required<number>();
  readonly lotNumber = input.required<string>();

  protected readonly visible = computed(() =>
    this.capabilities.isEnabled(COA_CAPABILITY) && this.auth.hasAnyRole(COA_READ_ROLES));
  protected readonly canGenerate = computed(() => this.visible() && this.auth.hasAnyRole(COA_QUALITY_ROLES));
  protected readonly certificates = signal<CertificateOfAnalysis[]>([]);
  protected readonly loading = signal(false);

  constructor() {
    effect(() => {
      const id = this.lotId();
      if (id && this.visible()) this.load(id);
    });
  }

  private load(lotId: number): void {
    this.loading.set(true);
    this.coaService.list({ lotId }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.certificates.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openGenerate(): void {
    this.dialog.open<GenerateCoaDialogComponent, GenerateCoaDialogData, CertificateOfAnalysis | undefined>(
      GenerateCoaDialogComponent,
      { width: '480px', data: { lotId: this.lotId(), lotNumber: this.lotNumber() } },
    ).afterClosed().subscribe(created => {
      if (created) this.certificates.update(list => [created, ...list]);
    });
  }

  protected confirmVoid(certificate: CertificateOfAnalysis): void {
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('coa.voidTitle'),
        message: this.translate.instant('coa.voidMessage', { number: certificate.certificateNumber }),
        confirmLabel: this.translate.instant('coa.void'),
        severity: 'danger',
      },
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.coaService.void(certificate.id).subscribe({
        next: voided => {
          this.certificates.update(list => list.map(c => c.id === voided.id ? voided : c));
          this.snackbar.success(this.translate.instant('coa.voidedMessage'));
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'coa.voidFailed'),
      });
    });
  }
}
