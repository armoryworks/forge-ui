import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { BankingService } from '../../services/banking.service';
import { VendorBankAccount } from '../../models/vendor-bank-account.model';
import { VendorService } from '../../../vendors/services/vendor.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

// ⚡ BANKING BOUNDARY — add / change a vendor ACH destination. The numbers are write-only:
// they are never echoed back (the server stores ciphertext + masks), so EDIT mode requires
// re-entering both numbers — and any change resets the account to PendingApproval (dual control).
@Component({
  selector: 'app-vendor-bank-account-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './vendor-bank-account-dialog.component.html',
  styleUrl: './vendor-bank-account-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorBankAccountDialogComponent implements OnInit {
  private readonly bankingService = inject(BankingService);
  private readonly vendorService = inject(VendorService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  /** Null = create; non-null = change the numbers of an existing account. */
  readonly account = input<VendorBankAccount | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly vendorOptions = signal<SelectOption[]>([]);

  protected readonly typeOptions: SelectOption[] = [
    { value: 'Checking', label: this.translate.instant('payables.bankAccounts.checking') },
    { value: 'Savings', label: this.translate.instant('payables.bankAccounts.savings') },
  ];

  protected readonly form = new FormGroup({
    vendorId: new FormControl<number | null>(null, [Validators.required]),
    nickname: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    accountType: new FormControl('Checking', [Validators.required]),
    routingNumber: new FormControl('', [Validators.required, Validators.pattern(/^\d{9}$/)]),
    accountNumber: new FormControl('', [Validators.required, Validators.pattern(/^\d{4,17}$/)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    vendorId: this.translate.instant('payables.vendor'),
    nickname: this.translate.instant('payables.bankAccounts.nickname'),
    accountType: this.translate.instant('payables.bankAccounts.type'),
    routingNumber: this.translate.instant('payables.bankAccounts.routing'),
    accountNumber: this.translate.instant('payables.bankAccounts.account'),
  });

  constructor() {
    this.vendorService.getVendorDropdown().pipe(takeUntilDestroyed()).subscribe({
      next: (vendors) => this.vendorOptions.set(
        vendors.map(v => ({ value: v.id, label: v.companyName }))),
    });
  }

  ngOnInit(): void {
    const existing = this.account();
    if (existing) {
      this.form.patchValue({
        vendorId: existing.vendorId,
        nickname: existing.nickname,
        accountType: existing.accountType,
      });
      this.form.controls.vendorId.disable(); // the account stays with its vendor
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);

    const value = this.form.getRawValue();
    const request = {
      nickname: value.nickname!,
      accountType: value.accountType!,
      routingNumber: value.routingNumber!,
      accountNumber: value.accountNumber!,
    };

    const existing = this.account();
    const request$ = existing
      ? this.bankingService.updateBankAccount(existing.id, request)
      : this.bankingService.createBankAccount(value.vendorId!, request);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('payables.bankAccounts.savedPendingApproval'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
