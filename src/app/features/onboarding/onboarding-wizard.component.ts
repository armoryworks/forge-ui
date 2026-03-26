import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
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

const DRAFT_KEY = 'qbe-onboarding-draft';

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

const LIST_A_TYPE_OPTIONS = [
  { value: 'U.S. Passport', label: 'U.S. Passport' },
  { value: 'U.S. Passport Card', label: 'U.S. Passport Card' },
  { value: 'Permanent Resident Card (I-551)', label: 'Permanent Resident Card (Form I-551)' },
  { value: 'Employment Authorization Document (I-766)', label: 'Employment Authorization Document (Form I-766)' },
  { value: 'Foreign Passport with I-94', label: 'Foreign Passport with I-94 Admission Number' },
  { value: 'Foreign Passport with I-551 Stamp', label: 'Foreign Passport with I-551 Stamp' },
];

const LIST_B_TYPE_OPTIONS = [
  { value: "Driver's License", label: "Driver's License" },
  { value: 'State ID Card', label: 'State-Issued ID Card' },
  { value: 'School ID with Photo', label: 'School ID Card with Photograph' },
  { value: 'Voter Registration Card', label: 'Voter Registration Card' },
  { value: 'Military ID', label: 'U.S. Military ID Card or Draft Record' },
  { value: 'Native American Tribal Document', label: 'Native American Tribal Document' },
];

const LIST_C_TYPE_OPTIONS = [
  { value: 'Social Security Card', label: 'U.S. Social Security Card (unrestricted)' },
  { value: 'Birth Certificate', label: 'Certified U.S. Birth Certificate' },
  { value: 'U.S. Citizen ID Card (I-197)', label: 'U.S. Citizen ID Card (Form I-197)' },
  { value: 'Native American Tribal Document', label: 'Native American Tribal Document' },
  { value: 'Employment Authorization (I-9)', label: 'Employment Authorization Document (DHS-issued)' },
];

interface I9Attachment {
  id: number;
  name: string;
}

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [
    CurrencyPipe,
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
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(EmployeeProfileService);

  // ── Step tracking — URL is source of truth (?step=0..6) ──────────────────
  protected readonly currentStepIndex = toSignal(
    this.route.queryParamMap.pipe(map(p => {
      const n = parseInt(p.get('step') ?? '0', 10);
      return isNaN(n) || n < 0 || n > 6 ? 0 : n;
    })),
    { initialValue: 0 },
  );

  protected readonly currentViolations = computed<string[]>(() => {
    switch (this.currentStepIndex()) {
      case 0: return this.personalViolations();
      case 1: return this.addressViolations();
      case 2: return this.w4Violations();
      case 3: return [] as string[];
      case 4: return this.i9Violations();
      case 5: return this.depositViolations();
      case 6: return this.ackViolations();
      default: return [] as string[];
    }
  });

  protected readonly currentFormInvalid = computed(() => {
    switch (this.currentStepIndex()) {
      case 0: return this.personalForm.invalid;
      case 1: return this.addressForm.invalid;
      case 2: return this.w4Form.invalid;
      case 3: return false;
      case 4: return this.i9Form.invalid;
      case 5: return this.depositForm.invalid;
      case 6: return this.ackForm.invalid || this.submitting();
      default: return false;
    }
  });

  protected nextStep(): void {
    const next = Math.min((this.currentStepIndex() ?? 0) + 1, 6);
    this.router.navigate([], { relativeTo: this.route, queryParams: { step: next }, queryParamsHandling: 'merge' });
  }

  protected prevStep(): void {
    const prev = Math.max((this.currentStepIndex() ?? 0) - 1, 0);
    this.router.navigate([], { relativeTo: this.route, queryParams: { step: prev }, queryParamsHandling: 'merge' });
  }

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

  // ── I-9 Document Upload State ─────────────────────────────────────────────
  protected readonly listAAttachment = signal<I9Attachment | null>(null);
  protected readonly listBAttachment = signal<I9Attachment | null>(null);
  protected readonly listCAttachment = signal<I9Attachment | null>(null);
  protected readonly uploadingListA = signal(false);
  protected readonly uploadingListB = signal(false);
  protected readonly uploadingListC = signal(false);

  // ── Options ──────────────────────────────────────────────────────────────
  protected readonly filingStatusOptions = FILING_STATUS_OPTIONS;
  protected readonly accountTypeOptions = ACCOUNT_TYPE_OPTIONS;
  protected readonly citizenshipOptions = CITIZENSHIP_OPTIONS;
  protected readonly stateFilingOptions = STATE_FILING_OPTIONS;
  protected readonly usStateOptions = US_STATES;
  protected readonly listATypeOptions = LIST_A_TYPE_OPTIONS;
  protected readonly listBTypeOptions = LIST_B_TYPE_OPTIONS;
  protected readonly listCTypeOptions = LIST_C_TYPE_OPTIONS;

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

  protected readonly personalViolations = FormValidationService.getViolations(this.personalForm, {
    firstName: 'First Name',
    lastName: 'Last Name',
    dateOfBirth: 'Date of Birth',
    ssn: 'Social Security Number',
    email: 'Email',
    phone: 'Phone',
  });

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

  protected readonly addressViolations = FormValidationService.getViolations(this.addressForm, {
    street1: 'Street Address',
    city: 'City',
    state: 'State',
    zipCode: 'ZIP Code',
  });

  // ── Step 3: W-4 Federal Withholding ──────────────────────────────────────
  protected readonly w4Form = new FormGroup({
    filingStatus: new FormControl(null, [Validators.required]),
    multipleJobs: new FormControl(false),
    // Step 3: Claim Dependents — 3a (qualifying children) and 3b (other dependents)
    qualifyingChildren: new FormControl<number>(0),
    otherDependents: new FormControl<number>(0),
    // Step 4: Other Adjustments (optional)
    otherIncome: new FormControl(0),
    deductions: new FormControl(0),
    extraWithholding: new FormControl(0),
    exemptFromWithholding: new FormControl(false),
  });

  // W-4 Step 3 computed dollar amounts (must be after w4Form)
  private readonly w4FormValue = toSignal(
    this.w4Form.valueChanges,
    { initialValue: this.w4Form.value },
  );

  protected readonly w4Step3a = computed(() =>
    (this.w4FormValue().qualifyingChildren ?? 0) * 2000
  );
  protected readonly w4Step3b = computed(() =>
    (this.w4FormValue().otherDependents ?? 0) * 500
  );
  protected readonly w4Step3Total = computed(() =>
    this.w4Step3a() + this.w4Step3b()
  );

  protected readonly w4Violations = FormValidationService.getViolations(this.w4Form, {
    filingStatus: 'Filing Status',
  });

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
    // Document verification
    documentChoice: new FormControl<'A' | 'BC' | null>(null),
    listAType: new FormControl(''),
    listADocNumber: new FormControl(''),
    listAAuthority: new FormControl(''),
    listAExpiry: new FormControl<Date | null>(null),
    listBType: new FormControl(''),
    listBDocNumber: new FormControl(''),
    listBAuthority: new FormControl(''),
    listBExpiry: new FormControl<Date | null>(null),
    listCType: new FormControl(''),
    listCDocNumber: new FormControl(''),
    listCAuthority: new FormControl(''),
    listCExpiry: new FormControl<Date | null>(null),
  });

  protected readonly i9Violations = FormValidationService.getViolations(this.i9Form, {
    citizenshipStatus: 'Citizenship Status',
  });

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

  protected readonly i9DocumentChoice = toSignal(
    this.i9Form.controls.documentChoice.valueChanges,
    { initialValue: this.i9Form.controls.documentChoice.value }
  );

  // ── Step 6: Direct Deposit ────────────────────────────────────────────────
  protected readonly depositForm = new FormGroup({
    bankName: new FormControl('', [Validators.required]),
    routingNumber: new FormControl('', [Validators.required, Validators.pattern(/^\d{9}$/)]),
    accountNumber: new FormControl('', [Validators.required]),
    accountType: new FormControl('Checking', [Validators.required]),
  });

  protected readonly depositViolations = FormValidationService.getViolations(this.depositForm, {
    bankName: 'Bank Name',
    routingNumber: 'Routing Number (9 digits)',
    accountNumber: 'Account Number',
    accountType: 'Account Type',
  });

  // ── Step 7: Acknowledgments ───────────────────────────────────────────────
  protected readonly ackForm = new FormGroup({
    workersComp: new FormControl(false, [Validators.requiredTrue]),
    handbook: new FormControl(false, [Validators.requiredTrue]),
  });

  protected readonly ackViolations = FormValidationService.getViolations(this.ackForm, {
    workersComp: "Workers' Compensation Acknowledgment",
    handbook: 'Employee Handbook Acknowledgment',
  });

  // ── Auto-save signals (all forms, must be after form declarations) ────────
  private readonly _personalVal = toSignal(this.personalForm.valueChanges, { initialValue: this.personalForm.value });
  private readonly _addressVal  = toSignal(this.addressForm.valueChanges,  { initialValue: this.addressForm.value });
  private readonly _w4Val       = toSignal(this.w4Form.valueChanges,       { initialValue: this.w4Form.value });
  private readonly _stateVal    = toSignal(this.stateForm.valueChanges,    { initialValue: this.stateForm.value });
  private readonly _i9Val       = toSignal(this.i9Form.valueChanges,       { initialValue: this.i9Form.value });
  private readonly _depositVal  = toSignal(this.depositForm.valueChanges,  { initialValue: this.depositForm.value });
  private readonly _ackVal      = toSignal(this.ackForm.valueChanges,      { initialValue: this.ackForm.value });

  // ── Constructor: restore draft, prefill, auto-save ───────────────────────
  constructor() {
    // Restore saved draft first — takes priority over admin prefill
    const draftRestored = this.restoreDraft();

    // Prefill from auth user only when no draft exists
    if (!draftRestored) {
      const user = this.authService.user();
      if (user) {
        this.personalForm.patchValue({
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          email: user.email ?? '',
        });
      }

      // Load employee profile and prefill whatever the admin already entered
      this.profileService.load();
      effect(() => {
        const profile = this.profileService.profile();
        if (!profile) return;
        this.personalForm.patchValue({
          ...(profile.phoneNumber ? { phone: profile.phoneNumber } : {}),
          ...(profile.dateOfBirth ? { dateOfBirth: new Date(profile.dateOfBirth) } : {}),
        });
        this.addressForm.patchValue({
          ...(profile.street1   ? { street1: profile.street1   } : {}),
          ...(profile.street2   ? { street2: profile.street2   } : {}),
          ...(profile.city      ? { city: profile.city         } : {}),
          ...(profile.state     ? { state: profile.state       } : {}),
          ...(profile.zipCode   ? { zipCode: profile.zipCode   } : {}),
        });
      });
    }

    // Auto-save to localStorage whenever any form value changes
    effect(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        personal: this._personalVal(),
        address:  this._addressVal(),
        w4:       this._w4Val(),
        state:    this._stateVal(),
        i9:       this._i9Val(),
        deposit:  this._depositVal(),
        ack:      this._ackVal(),
      }));
    });
  }

  // ── I-9 Document Methods ──────────────────────────────────────────────────
  protected setDocumentChoice(choice: 'A' | 'BC'): void {
    this.i9Form.controls.documentChoice.setValue(choice);
    if (choice === 'A') {
      this.listBAttachment.set(null);
      this.listCAttachment.set(null);
    } else {
      this.listAAttachment.set(null);
    }
  }

  protected onFileSelected(event: Event, list: 'A' | 'B' | 'C'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const uploading = list === 'A' ? this.uploadingListA : list === 'B' ? this.uploadingListB : this.uploadingListC;
    uploading.set(true);

    this.service.uploadI9Document(file, `List${list}`).subscribe({
      next: result => {
        uploading.set(false);
        const attach = list === 'A' ? this.listAAttachment : list === 'B' ? this.listBAttachment : this.listCAttachment;
        attach.set({ id: result.fileAttachmentId, name: result.fileName });
      },
      error: () => {
        uploading.set(false);
        this.snackbar.error(`Failed to upload document. Please try again.`);
      },
    });
  }

  protected clearList(list: 'A' | 'B' | 'C'): void {
    if (list === 'A') this.listAAttachment.set(null);
    else if (list === 'B') this.listBAttachment.set(null);
    else this.listCAttachment.set(null);
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
      // W-4 — 3a + 3b combined into total dependents credit amount
      w4FilingStatus: w.filingStatus!,
      w4MultipleJobs: w.multipleJobs ?? false,
      w4ClaimDependentsAmount: this.w4Step3Total(),
      w4OtherIncome: Number(w.otherIncome ?? 0),
      w4Deductions: Number(w.deductions ?? 0),
      w4ExtraWithholding: Number(w.extraWithholding ?? 0),
      w4ExemptFromWithholding: w.exemptFromWithholding ?? false,
      // State withholding
      stateFilingStatus: s.stateFilingStatus || undefined,
      stateAllowances: s.stateAllowances ?? undefined,
      stateAdditionalWithholding: s.stateAdditionalWithholding ?? undefined,
      stateExempt: s.stateExempt ?? undefined,
      // I-9 citizenship
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
      // I-9 document verification
      i9DocumentChoice: i.documentChoice || undefined,
      i9ListAType: i.listAType || undefined,
      i9ListADocNumber: i.listADocNumber || undefined,
      i9ListAAuthority: i.listAAuthority || undefined,
      i9ListAExpiry: i.listAExpiry ? toIsoDate(i.listAExpiry) ?? undefined : undefined,
      i9ListAFileAttachmentId: this.listAAttachment()?.id,
      i9ListBType: i.listBType || undefined,
      i9ListBDocNumber: i.listBDocNumber || undefined,
      i9ListBAuthority: i.listBAuthority || undefined,
      i9ListBExpiry: i.listBExpiry ? toIsoDate(i.listBExpiry) ?? undefined : undefined,
      i9ListBFileAttachmentId: this.listBAttachment()?.id,
      i9ListCType: i.listCType || undefined,
      i9ListCDocNumber: i.listCDocNumber || undefined,
      i9ListCAuthority: i.listCAuthority || undefined,
      i9ListCExpiry: i.listCExpiry ? toIsoDate(i.listCExpiry) ?? undefined : undefined,
      i9ListCFileAttachmentId: this.listCAttachment()?.id,
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
        localStorage.removeItem(DRAFT_KEY);
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

  // ── Draft persistence ─────────────────────────────────────────────────────
  private restoreDraft(): boolean {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      if (draft['personal']) this.personalForm.patchValue(draft['personal'] as never);
      if (draft['address'])  this.addressForm.patchValue(draft['address'] as never);
      if (draft['w4'])       this.w4Form.patchValue(draft['w4'] as never);
      if (draft['state'])    this.stateForm.patchValue(draft['state'] as never);
      if (draft['i9'])       this.i9Form.patchValue(draft['i9'] as never);
      if (draft['deposit'])  this.depositForm.patchValue(draft['deposit'] as never);
      if (draft['ack'])      this.ackForm.patchValue(draft['ack'] as never);
      return true;
    } catch {
      return false;
    }
  }
}
