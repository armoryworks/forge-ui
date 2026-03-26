import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { MatStepperModule } from '@angular/material/stepper';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toSignal } from '@angular/core/rxjs-interop';

import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { toIsoDate } from '../../shared/utils/date.utils';

import { AuthService } from '../../shared/services/auth.service';
import { EmployeeProfileService } from '../account/services/employee-profile.service';

import {
  OnboardingService,
  OnboardingSigningUrl,
  OnboardingSubmitRequest,
} from './onboarding.service';

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' }, { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' }, { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' }, { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' }, { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' }, { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' }, { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' }, { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' }, { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

const NO_INCOME_TAX_STATES = new Set(['AK', 'FL', 'NV', 'SD', 'TN', 'TX', 'WA', 'WY']);

const FILING_STATUS_OPTIONS = [
  { value: 'Single', label: 'Single or Married filing separately' },
  { value: 'MFJ', label: 'Married filing jointly or Qualifying surviving spouse' },
  { value: 'HH', label: 'Head of household' },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'Checking', label: 'Checking' },
  { value: 'Savings', label: 'Savings' },
];

const CITIZENSHIP_OPTIONS = [
  { value: '1', label: 'A citizen of the United States' },
  { value: '2', label: 'A noncitizen national of the United States' },
  { value: '3', label: 'A lawful permanent resident' },
  { value: '4', label: 'An alien authorized to work' },
];

const STATE_FILING_OPTIONS = [
  { value: 'Single', label: 'Single' },
  { value: 'Married', label: 'Married' },
  { value: 'MFJ', label: 'Married filing jointly' },
  { value: 'HH', label: 'Head of household' },
];

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatStepperModule,
    MatIconModule,
    MatProgressSpinnerModule,
    InputComponent,
    SelectComponent,
    DatepickerComponent,
    ToggleComponent,
    ValidationPopoverDirective,
  ],
  templateUrl: './onboarding-wizard.component.html',
  styleUrl: './onboarding-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: false } },
  ],
})
export class OnboardingWizardComponent {
  private readonly service = inject(OnboardingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(EmployeeProfileService);

  // ── State ────────────────────────────────────────────────────────────────
  protected readonly submitting = signal(false);
  protected readonly signingUrls = signal<OnboardingSigningUrl[]>([]);
  protected readonly currentSigningIndex = signal(0);
  protected readonly signingComplete = signal(false);

  protected readonly currentSigningItem = computed(() => {
    const urls = this.signingUrls();
    const idx = this.currentSigningIndex();
    return idx < urls.length ? urls[idx] : null;
  });

  protected readonly currentSigningUrl = computed((): SafeResourceUrl | null => {
    const item = this.currentSigningItem();
    if (!item) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(item.signingUrl);
  });

  // ── Options ──────────────────────────────────────────────────────────────
  protected readonly filingStatusOptions = FILING_STATUS_OPTIONS;
  protected readonly accountTypeOptions = ACCOUNT_TYPE_OPTIONS;
  protected readonly citizenshipOptions = CITIZENSHIP_OPTIONS;
  protected readonly stateFilingOptions = STATE_FILING_OPTIONS;
  protected readonly usStateOptions = US_STATES;

  // ── Step 1: Personal Information ─────────────────────────────────────────
  protected readonly personalForm = new FormGroup({
    firstName: new FormControl('', [Validators.required]),
    middleName: new FormControl(''),
    lastName: new FormControl('', [Validators.required]),
    otherLastNames: new FormControl(''),
    dateOfBirth: new FormControl<Date | null>(null, [Validators.required]),
    ssn: new FormControl('', [Validators.required, Validators.pattern(/^\d{3}-?\d{2}-?\d{4}$/)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    phone: new FormControl('', [Validators.required]),
  });

  protected readonly personalViolations = computed(() =>
    FormValidationService.getViolations(this.personalForm, {
      firstName: 'First Name',
      lastName: 'Last Name',
      dateOfBirth: 'Date of Birth',
      ssn: 'Social Security Number',
      email: 'Email',
      phone: 'Phone',
    })
  );

  // ── Step 2: Address ───────────────────────────────────────────────────────
  protected readonly addressForm = new FormGroup({
    street1: new FormControl('', [Validators.required]),
    street2: new FormControl(''),
    city: new FormControl('', [Validators.required]),
    state: new FormControl<string | null>(null, [Validators.required]),
    zipCode: new FormControl('', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]),
  });

  // ── Address-derived state context (must be after addressForm) ────────────
  private readonly addressStateValue = toSignal(
    this.addressForm.controls.state.valueChanges,
    { initialValue: this.addressForm.controls.state.value ?? '' },
  );

  protected readonly selectedStateName = computed(() => {
    const code = this.addressStateValue();
    return code ? (US_STATES.find(s => s.value === code)?.label ?? null) : null;
  });

  protected readonly hasNoIncomeTax = computed(() => {
    const code = this.addressStateValue();
    return !!code && NO_INCOME_TAX_STATES.has(code);
  });

  protected readonly addressViolations = computed(() =>
    FormValidationService.getViolations(this.addressForm, {
      street1: 'Street Address',
      city: 'City',
      state: 'State',
      zipCode: 'ZIP Code',
    })
  );

  // ── Step 3: W-4 Federal Withholding ──────────────────────────────────────
  protected readonly w4Form = new FormGroup({
    filingStatus: new FormControl('Single', [Validators.required]),
    multipleJobs: new FormControl(false),
    claimDependentsAmount: new FormControl(0),
    otherIncome: new FormControl(0),
    deductions: new FormControl(0),
    extraWithholding: new FormControl(0),
    exemptFromWithholding: new FormControl(false),
  });

  protected readonly w4Violations = computed(() =>
    FormValidationService.getViolations(this.w4Form, {
      filingStatus: 'Filing Status',
    })
  );

  // ── Step 4: State Withholding ─────────────────────────────────────────────
  protected readonly stateForm = new FormGroup({
    stateFilingStatus: new FormControl(''),
    stateAllowances: new FormControl<number | null>(null),
    stateAdditionalWithholding: new FormControl<number | null>(null),
    stateExempt: new FormControl(false),
  });

  // ── Step 5: I-9 Employment Eligibility ───────────────────────────────────
  protected readonly i9Form = new FormGroup({
    citizenshipStatus: new FormControl('1', [Validators.required]),
    alienRegNumber: new FormControl(''),
    i94Number: new FormControl(''),
    foreignPassportNumber: new FormControl(''),
    foreignPassportCountry: new FormControl(''),
    workAuthExpiry: new FormControl<Date | null>(null),
    preparedByPreparer: new FormControl(false),
    preparerFirstName: new FormControl(''),
    preparerLastName: new FormControl(''),
    preparerAddress: new FormControl(''),
    preparerCity: new FormControl(''),
    preparerState: new FormControl(''),
    preparerZip: new FormControl(''),
  });

  protected readonly i9Violations = computed(() =>
    FormValidationService.getViolations(this.i9Form, {
      citizenshipStatus: 'Citizenship Status',
    })
  );

  protected readonly i9CitizenshipStatus = toSignal(
    this.i9Form.controls.citizenshipStatus.valueChanges,
    { initialValue: '1' }
  );

  protected readonly i9NeedsAlienInfo = computed(() => {
    const status = this.i9CitizenshipStatus();
    return status === '3' || status === '4';
  });

  protected readonly i9PreparedByPreparer = toSignal(
    this.i9Form.controls.preparedByPreparer.valueChanges,
    { initialValue: false }
  );

  // ── Step 6: Direct Deposit ────────────────────────────────────────────────
  protected readonly depositForm = new FormGroup({
    bankName: new FormControl('', [Validators.required]),
    routingNumber: new FormControl('', [Validators.required, Validators.pattern(/^\d{9}$/)]),
    accountNumber: new FormControl('', [Validators.required]),
    accountType: new FormControl('Checking', [Validators.required]),
  });

  protected readonly depositViolations = computed(() =>
    FormValidationService.getViolations(this.depositForm, {
      bankName: 'Bank Name',
      routingNumber: 'Routing Number (9 digits)',
      accountNumber: 'Account Number',
      accountType: 'Account Type',
    })
  );

  // ── Step 7: Acknowledgments ───────────────────────────────────────────────
  protected readonly ackForm = new FormGroup({
    workersComp: new FormControl(false, [Validators.requiredTrue]),
    handbook: new FormControl(false, [Validators.requiredTrue]),
  });

  protected readonly ackViolations = computed(() =>
    FormValidationService.getViolations(this.ackForm, {
      workersComp: "Workers' Compensation Acknowledgment",
      handbook: 'Employee Handbook Acknowledgment',
    })
  );

  // ── Prefill from existing HR/auth data ───────────────────────────────────
  constructor() {
    // Prefill from auth user — always available
    const user = this.authService.user();
    if (user) {
      this.personalForm.patchValue({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
      });
    }

    // Load employee profile then prefill whatever the admin already entered
    this.profileService.load();
    effect(() => {
      const profile = this.profileService.profile();
      if (!profile) return;
      this.personalForm.patchValue({
        ...(profile.phoneNumber ? { phone: profile.phoneNumber } : {}),
        ...(profile.dateOfBirth
          ? { dateOfBirth: new Date(profile.dateOfBirth) }
          : {}),
      });
      this.addressForm.patchValue({
        ...(profile.street1 ? { street1: profile.street1 } : {}),
        ...(profile.street2 ? { street2: profile.street2 } : {}),
        ...(profile.city ? { city: profile.city } : {}),
        ...(profile.state ? { state: profile.state } : {}),
        ...(profile.zipCode ? { zipCode: profile.zipCode } : {}),
      });
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  protected submit(): void {
    if (this.submitting()) return;

    const p = this.personalForm.value;
    const a = this.addressForm.value;
    const w = this.w4Form.value;
    const s = this.stateForm.value;
    const i = this.i9Form.value;
    const d = this.depositForm.value;
    const k = this.ackForm.value;

    const request: OnboardingSubmitRequest = {
      // Personal
      firstName: p.firstName!,
      middleName: p.middleName || undefined,
      lastName: p.lastName!,
      otherLastNames: p.otherLastNames || undefined,
      dateOfBirth: toIsoDate(p.dateOfBirth!)!,
      ssn: p.ssn!,
      email: p.email!,
      phone: p.phone!,
      // Address
      street1: a.street1!,
      street2: a.street2 || undefined,
      city: a.city!,
      addressState: a.state as string,
      zipCode: a.zipCode!,
      // W-4
      w4FilingStatus: w.filingStatus!,
      w4MultipleJobs: w.multipleJobs ?? false,
      w4ClaimDependentsAmount: Number(w.claimDependentsAmount ?? 0),
      w4OtherIncome: Number(w.otherIncome ?? 0),
      w4Deductions: Number(w.deductions ?? 0),
      w4ExtraWithholding: Number(w.extraWithholding ?? 0),
      w4ExemptFromWithholding: w.exemptFromWithholding ?? false,
      // State withholding
      stateFilingStatus: s.stateFilingStatus || undefined,
      stateAllowances: s.stateAllowances ?? undefined,
      stateAdditionalWithholding: s.stateAdditionalWithholding ?? undefined,
      stateExempt: s.stateExempt ?? undefined,
      // I-9
      i9CitizenshipStatus: i.citizenshipStatus!,
      i9AlienRegNumber: i.alienRegNumber || undefined,
      i9I94Number: i.i94Number || undefined,
      i9ForeignPassportNumber: i.foreignPassportNumber || undefined,
      i9ForeignPassportCountry: i.foreignPassportCountry || undefined,
      i9WorkAuthExpiry: i.workAuthExpiry ? toIsoDate(i.workAuthExpiry) ?? undefined : undefined,
      i9PreparedByPreparer: i.preparedByPreparer ?? false,
      i9PreparerFirstName: i.preparerFirstName || undefined,
      i9PreparerLastName: i.preparerLastName || undefined,
      i9PreparerAddress: i.preparerAddress || undefined,
      i9PreparerCity: i.preparerCity || undefined,
      i9PreparerState: i.preparerState || undefined,
      i9PreparerZip: i.preparerZip || undefined,
      // Direct deposit
      bankName: d.bankName!,
      routingNumber: d.routingNumber!,
      accountNumber: d.accountNumber!,
      accountType: d.accountType!,
      // Acknowledgments
      acknowledgeWorkersComp: k.workersComp ?? false,
      acknowledgeHandbook: k.handbook ?? false,
    };

    this.submitting.set(true);
    this.service.submit(request).subscribe({
      next: result => {
        this.submitting.set(false);
        if (result.requiresSigning && result.signingUrls.length > 0) {
          this.signingUrls.set(result.signingUrls);
          this.currentSigningIndex.set(0);
        } else {
          this.signingComplete.set(true);
        }
      },
      error: () => {
        this.submitting.set(false);
        this.snackbar.error('Submission failed. Please try again.');
      },
    });
  }

  protected advanceSigning(): void {
    const next = this.currentSigningIndex() + 1;
    if (next >= this.signingUrls().length) {
      this.signingComplete.set(true);
    } else {
      this.currentSigningIndex.set(next);
    }
  }

  protected goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
