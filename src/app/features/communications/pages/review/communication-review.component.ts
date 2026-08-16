import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CommunicationService } from '../../services/communication.service';
import { CommunicationDetail } from '../../models/communication-detail.model';

/**
 * The review screen. A message on the left, an editable draft on the right, and
 * an approve button that is the only path from an inbound email to an order.
 *
 * <p><b>Nothing here is pre-approved.</b> The fields arrive pre-filled from
 * extraction, but every one is editable and what gets saved is what the reviewer
 * sees — the system proposes and a person confirms. That is a structural rule,
 * not a setting.</p>
 *
 * <p>The evidence panel is not decoration either. A reviewer approving an order
 * is asserting that a customer authorized work, and they cannot honestly do that
 * without seeing the document, its hash, and the prior agreements it leans on.</p>
 */
@Component({
  selector: 'app-communication-review',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatTooltipModule,
    TranslatePipe,
    PageLayoutComponent,
    LoadingBlockDirective,
    SpacerDirective,
    InputComponent,
    SelectComponent,
    CurrencyInputComponent,
    DatepickerComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './communication-review.component.html',
  styleUrl: './communication-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunicationReviewComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CommunicationService);
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly detail = signal<CommunicationDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly customerOptions = signal<SelectOption[]>([]);

  private readonly communicationId = toSignal(
    this.route.paramMap.pipe(map((p) => Number(p.get('id')) || 0)),
    { initialValue: 0 },
  );

  protected readonly form = this.fb.group({
    customerId: [null as number | null, Validators.required],
    authorizingArtifactId: [null as number | null, Validators.required],
    customerPo: ['', Validators.maxLength(50)],
    requestedDeliveryDate: [null as Date | null],
    taxRatePercent: [0, [Validators.min(0), Validators.max(99.9999)]],
    supportedByAttestationId: [null as number | null],
    note: ['', Validators.maxLength(2000)],
    lines: this.fb.array([] as FormGroup[]),
  });

  protected get lines(): FormArray {
    return this.form.controls.lines;
  }

  protected readonly violations = FormValidationService.getViolations(this.form, {
    customerId: this.translate.instant('review.fieldCustomer'),
    authorizingArtifactId: this.translate.instant('review.fieldAuthorizingDocument'),
    lines: this.translate.instant('review.fieldLines'),
  });

  /**
   * Only an exact sender match may feed a draft. A domain match files the
   * correspondence but proves nothing about who sent it, and unmatched proves
   * less. The screen still shows everything — it just will not let you approve.
   */
  protected readonly canApprove = computed(() => this.detail()?.matchConfidence === 'Exact');

  protected readonly confidenceKey = computed(() =>
    `review.confidence.${this.detail()?.matchConfidence ?? 'Unmatched'}`,
  );

  protected readonly confidenceClass = computed(() => {
    switch (this.detail()?.matchConfidence) {
      case 'Exact': return 'chip chip--success';
      case 'Domain': return 'chip chip--warning';
      default: return 'chip chip--error';
    }
  });

  /** Artifacts as picker options, so the reviewer names which document IS the authorization. */
  protected readonly artifactOptions = computed<SelectOption[]>(() =>
    (this.detail()?.artifacts ?? []).map((a) => ({
      value: a.id,
      label: a.originalFilename ?? `${a.kind} #${a.id}`,
    })),
  );

  protected readonly agreementOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('review.noSupportingAgreement') },
    ...(this.detail()?.priorAgreements ?? []).map((a) => ({
      value: a.id,
      label: `${a.statementType}${a.filename ? ` — ${a.filename}` : ''}`,
    })),
  ]);

  protected readonly total = signal(0);

  constructor() {
    this.customerService.getCustomers(undefined, true).subscribe({
      next: (customers) => this.customerOptions.set(
        customers.map((c) => ({
          value: c.id,
          label: c.companyName ? `${c.name} (${c.companyName})` : c.name,
        })),
      ),
    });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recomputeTotal());

    this.load();
  }

  private load(): void {
    const id = this.communicationId();
    if (!id) return;

    this.loading.set(true);
    this.service.getDetail(id).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.prefill(detail);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /**
   * Seeds the form from what arrived. Deliberately conservative: the customer
   * comes from the resolved party, the authorizing document defaults to the
   * first attachment (a PO usually arrives as one), and at least one blank line
   * always exists so there is somewhere to type.
   */
  private prefill(detail: CommunicationDetail): void {
    if (detail.partyType === 'Customer' && detail.partyId) {
      this.form.controls.customerId.setValue(detail.partyId);
    }

    const firstAttachment = detail.artifacts.find((a) => a.kind === 'Attachment');
    if (firstAttachment) {
      this.form.controls.authorizingArtifactId.setValue(firstAttachment.id);
    }

    if (detail.priorAgreements.length === 1) {
      this.form.controls.supportedByAttestationId.setValue(detail.priorAgreements[0].id);
    }

    this.lines.clear();
    this.addLine();
  }

  private newLine(): FormGroup {
    return this.fb.group({
      description: ['', [Validators.required, Validators.maxLength(500)]],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
    });
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected removeLine(index: number): void {
    if (this.lines.length <= 1) return;
    this.lines.removeAt(index);
  }

  protected readonly canRemoveLine = computed(() => this.lines.length > 1);

  private recomputeTotal(): void {
    const raw = this.form.getRawValue();
    const sum = (raw.lines as Array<{ quantity: number; unitPrice: number }>).reduce(
      (acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
    this.total.set(sum * (1 + (Number(raw.taxRatePercent) || 0) / 100));
  }

  protected shortHash(hash: string): string {
    return `${hash.slice(0, 12)}…`;
  }

  protected approve(): void {
    if (this.form.invalid || this.saving() || !this.canApprove()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();

    this.service.approveDraft(this.communicationId(), {
      customerId: raw.customerId!,
      authorizingArtifactId: raw.authorizingArtifactId!,
      customerPo: raw.customerPo?.trim() || null,
      requestedDeliveryDate: raw.requestedDeliveryDate
        ? new Date(raw.requestedDeliveryDate).toISOString()
        : null,
      taxRate: (Number(raw.taxRatePercent) || 0) / 100,
      supportedByAttestationId: raw.supportedByAttestationId ?? null,
      note: raw.note?.trim() || null,
      lines: (raw.lines as Array<{ description: string; quantity: number; unitPrice: number }>)
        .map((l) => ({
          partId: null,
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          notes: null,
        })),
    }).subscribe({
      next: (result) => {
        this.snackbar.success(
          this.translate.instant('review.approved', { number: result.orderNumber }),
        );
        this.router.navigate(['/sales-orders'], {
          queryParams: { detail: `sales-order:${result.salesOrderId}` },
        });
      },
      error: () => this.saving.set(false),
    });
  }
}
