import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { fromEvent, filter, map, startWith } from 'rxjs';
import { AbstractControl, ReactiveFormsModule, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { MatStepperModule } from '@angular/material/stepper';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { LayoutService } from '../../shared/services/layout.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { toIsoDate } from '../../shared/utils/date.utils';

import { AuthService } from '../../shared/services/auth.service';

import {
  OnboardingDraftStatus,
  OnboardingFormToSignItem,
  OnboardingPolicyDocs,
  OnboardingService,
  OnboardingSigningUrl,
  OnboardingSubmitRequest,
  SaveOnboardingDraftRequest,
} from './onboarding.service';

const REVIEW_STATE_KEY = 'forge-onboarding-review-state';

/**
 * Default OnboardingDraftStatus before the server response lands. All Has*
 * flags default false so the wizard renders required-field behavior until we
 * know otherwise.
 */
const EMPTY_DRAFT_STATUS: OnboardingDraftStatus = {
  firstName: null, middleName: null, lastName: null, dateOfBirth: null,
  email: null, phone: null, hasSsn: false,
  street1: null, street2: null, city: null, addressState: null, zipCode: null,
  w4FilingStatus: null, w4MultipleJobs: null,
  w4QualifyingChildren: null, w4OtherDependents: null,
  w4OtherIncome: null, w4Deductions: null, w4ExtraWithholding: null,
  w4ExemptFromWithholding: null,
  stateFilingStatus: null, stateAllowances: null,
  stateAdditionalWithholding: null, stateExempt: null,
  i9CitizenshipStatus: null,
  hasAlienRegNumber: false, hasI94Number: false, hasForeignPassportNumber: false,
  i9ForeignPassportCountry: null, i9WorkAuthExpiry: null,
  i9DocumentChoice: null,
  i9ListAType: null, i9ListAAuthority: null, i9ListAExpiry: null,
  i9ListAFileAttachmentId: null, hasListADocNumber: false,
  i9ListBType: null, i9ListBAuthority: null, i9ListBExpiry: null,
  i9ListBFileAttachmentId: null, hasListBDocNumber: false,
  i9ListCType: null, i9ListCAuthority: null, i9ListCExpiry: null,
  i9ListCFileAttachmentId: null, hasListCDocNumber: false,
  bankName: null, accountType: null, hasBankRouting: false, hasBankAccount: false,
};

interface PersistedReviewState {
  formsToSign: OnboardingFormToSignItem[];
  currentFormIndex: number;
  signedFormIndices: number[];
  reviewPhase: 'idle' | 'preview' | 'signing';
}

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
    CurrencyInputComponent,
    ValidationButtonComponent,
    TranslatePipe,
  ],
  templateUrl: './onboarding-wizard.component.html',
  styleUrl: './onboarding-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [
    { provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: false } },
  ],
})
export class OnboardingWizardComponent {
  private readonly service = inject(OnboardingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly layout = inject(LayoutService);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly sanitizer = inject(DomSanitizer);

  // ── Step tracking — URL is source of truth (?step=0..6) ──────────────────
  protected readonly currentStepIndex = toSignal(
    this.route.queryParamMap.pipe(map(p => {
      const n = parseInt(p.get('step') ?? '0', 10);
      return isNaN(n) || n < 0 || n > 6 ? 0 : n;
    })),
    { initialValue: 0 },
  );

  // Review-phase params live in the URL too (?review=preview|signing&formIdx=N)
  // so the address bar represents what the user is looking at and a shared
  // link can land on the same screen. The formsToSign list itself is too
  // large to embed; we keep it in localStorage and restore from there.

  protected readonly currentViolations = computed<string[]>(() => {
    switch (this.currentStepIndex()) {
      case 0: return this.personalViolations();
      case 1: return this.addressViolations();
      case 2: return this.w4Violations();
      case 3: return this.stateViolations();
      case 4: return this.i9Violations();
      case 5: return this.depositViolations();
      case 6: return this.ackViolations();
      default: return [] as string[];
    }
  });

  protected readonly currentFormInvalid = computed(() => {
    switch (this.currentStepIndex()) {
      case 0: return this.personalFormStatus()  === 'INVALID';
      case 1: return this.addressFormStatus()   === 'INVALID';
      case 2: return this.w4FormStatus()        === 'INVALID';
      case 3: return this.stateFormStatus()     === 'INVALID';
      case 4: return this.i9FormStatus()        === 'INVALID';
      case 5: return this.depositFormStatus()   === 'INVALID';
      case 6: return this.ackFormStatus()       === 'INVALID' || this.submitting();
      default: return false;
    }
  });

  protected nextStep(): void {
    const current = this.currentStepIndex() ?? 0;
    this.saveStepToDraft(current);
    const next = Math.min(current + 1, 6);
    this.router.navigate([], { relativeTo: this.route, queryParams: { step: next }, queryParamsHandling: 'merge' });
  }

  protected prevStep(): void {
    const current = this.currentStepIndex() ?? 0;
    this.saveStepToDraft(current);
    const prev = Math.max(current - 1, 0);
    this.router.navigate([], { relativeTo: this.route, queryParams: { step: prev }, queryParamsHandling: 'merge' });
  }

  /**
   * Fires when the user clicks a step header in the mat-stepper. Persists the
   * step they're leaving (so jumps don't lose work) and routes the click
   * through the URL so ?step= stays the source of truth — without this the
   * stepper would change selectedIndex internally but the next change to
   * currentStepIndex() would yank it back. Material's linear mode gates the
   * click to visited/current steps before this fires.
   */
  protected onStepperSelectionChange(index: number): void {
    const current = this.currentStepIndex() ?? 0;
    if (index === current) return;
    this.saveStepToDraft(current);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: index },
      queryParamsHandling: 'merge',
    });
  }

  // ── State ────────────────────────────────────────────────────────────────
  protected readonly submitting = signal(false);
  // Legacy: kept for DocuSeal postMessage listener compatibility
  protected readonly signingUrls = signal<OnboardingSigningUrl[]>([]);
  protected readonly signingComplete = signal(false);

  // ── Per-form review flow state ────────────────────────────────────────────
  /** Forms to be reviewed/signed, returned by POST /save */
  protected readonly formsToSign = signal<OnboardingFormToSignItem[]>([]);
  protected readonly currentFormIndex = signal(0);
  protected readonly currentForm = computed(() => {
    const forms = this.formsToSign();
    const idx = this.currentFormIndex();
    return idx < forms.length ? forms[idx] : null;
  });

  /** 'idle' = wizard steps; 'preview' = showing filled PDF; 'signing' = DocuSeal embed */
  protected readonly reviewPhase = signal<'idle' | 'preview' | 'signing'>('idle');
  protected readonly previewPdfBase64 = signal<string | null>(null);
  protected readonly loadingPreview = signal(false);
  protected readonly signingFormInProgress = signal(false);
  protected readonly currentSigningUrl = signal<string | null>(null);
  /** Safe blob URL for the <embed> PDF viewer — updated whenever previewPdfBase64 changes. */
  protected readonly pdfSafeUrl = signal<SafeResourceUrl | null>(null);
  private _pdfBlobUrl: string | null = null;
  protected readonly signedFormIndices = signal<Set<number>>(new Set());
  protected readonly currentFormSigned = computed(() =>
    this.signedFormIndices().has(this.currentFormIndex())
  );

  // Legacy compat alias (used in DocuSeal postMessage handler)
  protected readonly currentSigningIndex = this.currentFormIndex;
  protected readonly currentSigningItem = computed(() => {
    const url = this.currentSigningUrl();
    const form = this.currentForm();
    if (!url || !form) return null;
    return { signingUrl: url, formType: form.formType, formName: form.formName, submissionId: 0 } as OnboardingSigningUrl;
  });

  // Human-readable labels for review summary
  protected readonly w4FilingLabel = computed(() => {
    const v = this._w4Val().filingStatus as string | null | undefined;
    if (!v) return '—';
    return FILING_STATUS_OPTIONS.find(o => o.value === v)?.label ?? v;
  });
  protected readonly stateFilingLabel = computed(() => {
    const v = this._stateVal().stateFilingStatus;
    if (!v) return '—';
    return STATE_FILING_OPTIONS.find(o => o.value === v)?.label ?? v;
  });
  protected readonly citizenshipLabel = computed(() => {
    const v = this._i9Val().citizenshipStatus;
    if (!v) return '—';
    return CITIZENSHIP_OPTIONS.find(o => o.value === v)?.label ?? v;
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
    filingStatus: new FormControl<string | null>(null, [Validators.required]),
    multipleJobs: new FormControl(false),
    // Step 3: Claim Dependents — 3a (qualifying children) and 3b (other dependents)
    qualifyingChildren: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    otherDependents: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    // Step 4: Other Adjustments (optional — leave blank if not applicable)
    otherIncome: new FormControl<number | null>(null, [Validators.min(0)]),
    deductions: new FormControl<number | null>(null, [Validators.min(0)]),
    extraWithholding: new FormControl<number | null>(null, [Validators.min(0)]),
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
    qualifyingChildren: 'Qualifying Children (3a)',
    otherDependents: 'Other Dependents (3b)',
    otherIncome: 'Other Income (4a)',
    deductions: 'Deductions (4b)',
    extraWithholding: 'Extra Withholding (4c)',
  });

  // ── Step 4: State Withholding ─────────────────────────────────────────────
  protected readonly stateForm = new FormGroup({
    stateFilingStatus: new FormControl('', [Validators.required]),
    stateAllowances: new FormControl<number | null>(null),
    stateAdditionalWithholding: new FormControl<number | null>(null),
    stateExempt: new FormControl(false),
  });

  protected readonly stateExempt = toSignal(
    this.stateForm.controls.stateExempt.valueChanges.pipe(startWith(false)),
    { initialValue: false },
  );

  protected readonly stateViolations = FormValidationService.getViolations(this.stateForm, {
    stateFilingStatus: 'State Filing Status',
  });

  // ── Step 5: I-9 Employment Eligibility ───────────────────────────────────
  protected readonly i9Form = new FormGroup({
    citizenshipStatus: new FormControl('', [Validators.required]),
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
    documentChoice: new FormControl<'A' | 'BC' | null>(null, [Validators.required]),
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
    // Hidden controls that track uploaded file IDs — required conditionally
    listAFileId: new FormControl<number | null>(null),
    listBFileId: new FormControl<number | null>(null),
    listCFileId: new FormControl<number | null>(null),
  });

  protected readonly i9Violations = FormValidationService.getViolations(this.i9Form, {
    citizenshipStatus: 'Citizenship Status',
    documentChoice: 'Document Selection (List A or List B+C)',
    listAType: 'List A — Document Type',
    listADocNumber: 'List A — Document Number',
    listAAuthority: 'List A — Issuing Authority',
    listAFileId: 'List A — Document Upload',
    listBType: 'List B — Document Type',
    listBDocNumber: 'List B — Document Number',
    listBAuthority: 'List B — Issuing Authority',
    listBFileId: 'List B — Document Upload',
    listCType: 'List C — Document Type',
    listCDocNumber: 'List C — Document Number',
    listCAuthority: 'List C — Issuing Authority',
    listCFileId: 'List C — Document Upload',
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
  // Voided check upload was removed 2026-05-10 — payroll ops confirmed it's no
  // longer required for direct-deposit setup (routing + account number is
  // sufficient). Backend `VoidedCheckFileAttachmentId` remains nullable in case
  // it's reintroduced later; we just no longer prompt for it here.
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
  // Handbook ack is required only when an actual handbook URL is configured —
  // policyDocs is loaded on init and we (re)apply Validators.requiredTrue
  // accordingly. Workers' comp ack is always required.
  protected readonly ackForm = new FormGroup({
    workersComp: new FormControl(false, [Validators.requiredTrue]),
    handbook: new FormControl(false),
  });

  protected readonly policyDocs = signal<OnboardingPolicyDocs>({
    workersCompDocUrl: null,
    handbookDocUrl: null,
  });
  protected readonly hasHandbook = computed(() => !!this.policyDocs().handbookDocUrl);

  /**
   * Server-side onboarding draft status. Drives the "Securely stored — re-enter
   * to overwrite" indicator next to SSN / bank / I-9-doc-number fields, and
   * the relaxed-required validators applied when those values are already
   * stored. Replaces the localStorage draft for sensitive data — see the
   * 6c5eae1 commit for the threat model.
   */
  protected readonly draftStatus = signal<OnboardingDraftStatus>(EMPTY_DRAFT_STATUS);
  protected readonly hasStoredSsn          = computed(() => this.draftStatus().hasSsn);
  protected readonly hasStoredBankRouting  = computed(() => this.draftStatus().hasBankRouting);
  protected readonly hasStoredBankAccount  = computed(() => this.draftStatus().hasBankAccount);
  protected readonly hasStoredListADocNum  = computed(() => this.draftStatus().hasListADocNumber);
  protected readonly hasStoredListBDocNum  = computed(() => this.draftStatus().hasListBDocNumber);
  protected readonly hasStoredListCDocNum  = computed(() => this.draftStatus().hasListCDocNumber);
  protected readonly hasStoredAlienReg         = computed(() => this.draftStatus().hasAlienRegNumber);
  protected readonly hasStoredI94              = computed(() => this.draftStatus().hasI94Number);
  protected readonly hasStoredForeignPassport  = computed(() => this.draftStatus().hasForeignPassportNumber);

  protected readonly ackViolations = FormValidationService.getViolations(this.ackForm, {
    workersComp: "Workers' Compensation Acknowledgment",
    handbook: 'Employee Handbook Acknowledgment',
  });

  // Reactive form status signals — computed() won't re-run on plain .invalid (not a signal)
  private readonly personalFormStatus  = toSignal(this.personalForm.statusChanges.pipe(startWith(this.personalForm.status)),  { initialValue: this.personalForm.status });
  private readonly addressFormStatus   = toSignal(this.addressForm.statusChanges.pipe(startWith(this.addressForm.status)),   { initialValue: this.addressForm.status });
  private readonly w4FormStatus        = toSignal(this.w4Form.statusChanges.pipe(startWith(this.w4Form.status)),             { initialValue: this.w4Form.status });
  private readonly stateFormStatus     = toSignal(this.stateForm.statusChanges.pipe(startWith(this.stateForm.status)),       { initialValue: this.stateForm.status });
  private readonly i9FormStatus        = toSignal(this.i9Form.statusChanges.pipe(startWith(this.i9Form.status)),             { initialValue: this.i9Form.status });
  private readonly depositFormStatus   = toSignal(this.depositForm.statusChanges.pipe(startWith(this.depositForm.status)),   { initialValue: this.depositForm.status });
  private readonly ackFormStatus       = toSignal(this.ackForm.statusChanges.pipe(startWith(this.ackForm.status)),           { initialValue: this.ackForm.status });

  // ── Auto-save signals (all forms, must be after form declarations) ────────
  private readonly _personalVal = toSignal(this.personalForm.valueChanges, { initialValue: this.personalForm.value });
  private readonly _addressVal  = toSignal(this.addressForm.valueChanges,  { initialValue: this.addressForm.value });
  protected readonly _w4Val     = toSignal(this.w4Form.valueChanges,       { initialValue: this.w4Form.value });
  protected readonly _stateVal  = toSignal(this.stateForm.valueChanges,    { initialValue: this.stateForm.value });
  protected readonly _i9Val     = toSignal(this.i9Form.valueChanges,       { initialValue: this.i9Form.value });
  protected readonly _depositVal = toSignal(this.depositForm.valueChanges,  { initialValue: this.depositForm.value });
  private readonly _ackVal      = toSignal(this.ackForm.valueChanges,      { initialValue: this.ackForm.value });

  // ── Constructor: restore draft, prefill, auto-save ───────────────────────
  constructor() {
    // When exempt is toggled on, filing status is no longer required.
    // Fire stateForm.updateValueAndValidity() at the end (no emitEvent:false)
    // so stateViolations picks up the relaxed validator immediately.
    effect(() => {
      const ctrl = this.stateForm.controls.stateFilingStatus;
      if (this.stateExempt()) {
        ctrl.removeValidators(Validators.required);
      } else {
        ctrl.addValidators(Validators.required);
      }
      ctrl.updateValueAndValidity({ emitEvent: false });
      this.stateForm.updateValueAndValidity();
    });

    // Load policy docs — handbook ack is required only when a URL is set
    this.service.getPolicyDocs().subscribe({
      next: docs => this.policyDocs.set(docs),
      error: () => {}, // Non-fatal — UI falls back to no links + no handbook section
    });

    // Re-apply handbook required validator whenever the handbook URL flips
    effect(() => {
      const ctrl = this.ackForm.controls.handbook;
      if (this.hasHandbook()) {
        ctrl.addValidators(Validators.requiredTrue);
      } else {
        ctrl.removeValidators(Validators.requiredTrue);
        // If no handbook is configured, the field shouldn't block submit
        ctrl.setValue(false, { emitEvent: false });
      }
      ctrl.updateValueAndValidity({ emitEvent: false });
    });

    // Restore review state BEFORE loading the draft — if the user was
    // mid-signing when they refreshed, drop them back into the review flow.
    this.restoreReviewState();

    // Server-side onboarding draft is the source of truth. Patches forms with
    // every non-sensitive value the server has + sets Has* flags for the
    // sensitive ones (SSN, bank routing/account, I-9 doc numbers — those
    // never come back to the client). Auth-user email/name still primes the
    // form for the very first session before any draft exists.
    const user = this.authService.user();
    if (user) {
      this.personalForm.patchValue({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
      });
    }
    this.service.getDraft().subscribe({
      next: status => this.applyDraftStatus(status),
      error: () => {}, // First-time user — empty draft is fine
    });

    // Relax Validators.required on sensitive fields when the server tells us
    // they're already stored. The user can leave them blank to keep the
    // existing encrypted value; typing a new value overwrites on next save.
    effect(() => this.applySensitiveValidators());

    // Conditionally require document fields based on selected list. The doc-
    // number controls are special — when hasStoredList*DocNum is true the
    // value is already encrypted server-side and a blank wizard field is
    // intentional ("Securely stored" indicator). Skip setting Validators.required
    // on those specific controls so we don't override applySensitiveValidators.
    effect(() => {
      const choice = this.i9DocumentChoice();
      const ctrl = this.i9Form.controls;
      const hasStoredA = this.hasStoredListADocNum();
      const hasStoredB = this.hasStoredListBDocNum();
      const hasStoredC = this.hasStoredListCDocNum();

      const allDocFields = [
        ctrl.listAType, ctrl.listADocNumber, ctrl.listAAuthority, ctrl.listAFileId,
        ctrl.listBType, ctrl.listBDocNumber, ctrl.listBAuthority, ctrl.listBFileId,
        ctrl.listCType, ctrl.listCDocNumber, ctrl.listCAuthority, ctrl.listCFileId,
      ];
      allDocFields.forEach(c => { c.clearValidators(); c.updateValueAndValidity({ emitEvent: false }); });

      const requireUnlessStored = (c: AbstractControl, stored: boolean) => {
        if (!stored) {
          c.setValidators([Validators.required]);
          c.updateValueAndValidity({ emitEvent: false });
        }
      };
      const requireAlways = (c: AbstractControl) => {
        c.setValidators([Validators.required]);
        c.updateValueAndValidity({ emitEvent: false });
      };

      if (choice === 'A') {
        [ctrl.listAType, ctrl.listAAuthority, ctrl.listAFileId].forEach(requireAlways);
        requireUnlessStored(ctrl.listADocNumber, hasStoredA);
      } else if (choice === 'BC') {
        [ctrl.listBType, ctrl.listBAuthority, ctrl.listBFileId,
         ctrl.listCType, ctrl.listCAuthority, ctrl.listCFileId].forEach(requireAlways);
        requireUnlessStored(ctrl.listBDocNumber, hasStoredB);
        requireUnlessStored(ctrl.listCDocNumber, hasStoredC);
      }

      this.i9Form.updateValueAndValidity();
    });

    // Server-side draft is now the source of truth — saveDraft() is called
    // from saveStepToDraft() on Continue / step jumps, not on every keystroke.
    // localStorage no longer carries any onboarding form data; review state
    // (formsToSign + currentFormIndex + ...) still uses REVIEW_STATE_KEY
    // because it's not sensitive.

    // Persist review state — formsToSign + currentFormIndex + signedFormIndices +
    // reviewPhase — so a refresh during the e-sign loop puts the user back
    // where they were rather than the wizard's last step (reported 2026-05-10).
    effect(() => {
      const forms = this.formsToSign();
      const phase = this.reviewPhase();
      if (phase === 'idle' && forms.length === 0) {
        localStorage.removeItem(REVIEW_STATE_KEY);
        return;
      }
      const state: PersistedReviewState = {
        formsToSign: forms,
        currentFormIndex: this.currentFormIndex(),
        signedFormIndices: Array.from(this.signedFormIndices()),
        reviewPhase: phase,
      };
      localStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(state));
    });

    // Mirror review state into the URL (?review=preview|signing&formIdx=N) so
    // the address bar represents what the user is actually looking at and
    // bookmarks / shared links round-trip correctly. Skipped while idle so
    // we don't pollute the URL during the regular wizard flow.
    effect(() => {
      const phase = this.reviewPhase();
      const idx = this.currentFormIndex();
      if (phase === 'idle') {
        const params = this.route.snapshot.queryParamMap;
        if (params.has('review') || params.has('formIdx')) {
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { review: null, formIdx: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
        return;
      }
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { review: phase, formIdx: idx },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    // Convert base64 PDF → blob URL → SafeResourceUrl for <embed> viewer.
    // Revokes the previous blob URL to prevent memory leaks.
    effect(() => {
      const b64 = this.previewPdfBase64();
      if (this._pdfBlobUrl) {
        URL.revokeObjectURL(this._pdfBlobUrl);
        this._pdfBlobUrl = null;
      }
      if (!b64) {
        this.pdfSafeUrl.set(null);
        return;
      }
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      this._pdfBlobUrl = URL.createObjectURL(blob);
      this.pdfSafeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this._pdfBlobUrl));
    });

    // Listen for DocuSeal submission completion via postMessage.
    // Origin must match the app's own origin because DocuSeal is proxied through
    // /docuseal/ (same-origin). Rejecting foreign origins prevents any third-party
    // page from faking a "signed" event.
    fromEvent<MessageEvent>(window, 'message').pipe(
      filter(e => {
        if (e.origin !== window.location.origin) return false;
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          return data?.message === 'docuseal:completed'
            || data?.docuseal === 'completed'
            || !!data?.docuseal_completed;
        } catch { return false; }
      }),
      takeUntilDestroyed(),
    ).subscribe(() => {
      const idx = this.currentFormIndex();
      this.signedFormIndices.update((s: Set<number>) => new Set([...s, idx]));
      // Advance to next form automatically after signing
      this.advanceToNextForm();
    });
  }

  // ── I-9 Document Methods ──────────────────────────────────────────────────
  protected setDocumentChoice(choice: 'A' | 'BC'): void {
    this.i9Form.controls.documentChoice.setValue(choice);
    // Do NOT clear the other list's uploaded file — the user may switch back and
    // their upload should be preserved. Validators are conditional so the unused
    // list's fileId won't affect form validity.
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
        const fileCtrl = list === 'A' ? this.i9Form.controls.listAFileId
          : list === 'B' ? this.i9Form.controls.listBFileId
          : this.i9Form.controls.listCFileId;
        fileCtrl.setValue(result.fileAttachmentId);
      },
      error: () => {
        uploading.set(false);
        this.snackbar.error(this.translate.instant('onboarding.errors.uploadFailed'));
      },
    });
  }

  protected clearList(list: 'A' | 'B' | 'C'): void {
    if (list === 'A') {
      this.listAAttachment.set(null);
      this.i9Form.controls.listAFileId.setValue(null);
    } else if (list === 'B') {
      this.listBAttachment.set(null);
      this.i9Form.controls.listBFileId.setValue(null);
    } else {
      this.listCAttachment.set(null);
      this.i9Form.controls.listCFileId.setValue(null);
    }
  }

  // ── Build canonical request from all form values ──────────────────────────
  private buildRequest(): OnboardingSubmitRequest {
    const p = this.personalForm.value;
    const a = this.addressForm.value;
    const w = this.w4Form.value;
    const s = this.stateForm.value;
    const i = this.i9Form.value;
    const d = this.depositForm.value;
    const k = this.ackForm.value;
    return {
      firstName: p.firstName!,
      middleName: p.middleName || undefined,
      lastName: p.lastName!,
      otherLastNames: p.otherLastNames || undefined,
      dateOfBirth: toIsoDate(p.dateOfBirth!)!,
      ssn: p.ssn!,
      email: p.email!,
      phone: p.phone!,
      street1: a.street1!,
      street2: a.street2 || undefined,
      city: a.city!,
      addressState: a.state as string,
      zipCode: a.zipCode!,
      w4FilingStatus: w.filingStatus!,
      w4MultipleJobs: w.multipleJobs ?? false,
      w4ClaimDependentsAmount: this.w4Step3Total(),
      w4OtherIncome: Number(w.otherIncome ?? 0),
      w4Deductions: Number(w.deductions ?? 0),
      w4ExtraWithholding: Number(w.extraWithholding ?? 0),
      w4ExemptFromWithholding: w.exemptFromWithholding ?? false,
      stateFilingStatus: s.stateFilingStatus || undefined,
      stateAllowances: s.stateAllowances ?? undefined,
      stateAdditionalWithholding: s.stateAdditionalWithholding ?? undefined,
      stateExempt: s.stateExempt ?? undefined,
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
      bankName: d.bankName!,
      routingNumber: d.routingNumber!,
      accountNumber: d.accountNumber!,
      accountType: d.accountType!,
      acknowledgeWorkersComp: k.workersComp ?? false,
      acknowledgeHandbook: k.handbook ?? false,
    };
  }

  // ── Step 1 of review flow: save data, get forms to sign ──────────────────
  protected submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.service.saveData(this.buildRequest()).subscribe({
      next: result => {
        this.submitting.set(false);
        if (result.formsToSign.length > 0) {
          this.formsToSign.set(result.formsToSign);
          this.currentFormIndex.set(0);
          this.reviewPhase.set('preview');
          this.loadPreviewForCurrentForm();
        } else {
          // Nothing to sign — onboarding is done. Clear review state.
          // (Server-side draft persists; that's the authoritative record.)
          localStorage.removeItem(REVIEW_STATE_KEY);
          this.signingComplete.set(true);
        }
      },
      error: () => {
        this.submitting.set(false);
        this.snackbar.error(this.translate.instant('onboarding.errors.submissionFailed'));
      },
    });
  }

  // ── Step 2a: load PDF preview for the current form ────────────────────────
  protected loadPreviewForCurrentForm(): void {
    const form = this.currentForm();
    if (!form) return;

    if (!form.hasTemplate) {
      // No PDF template configured — skip straight to signing
      this.reviewPhase.set('signing');
      this.loadSigningUrlForCurrentForm();
      return;
    }

    this.loadingPreview.set(true);
    this.previewPdfBase64.set(null);
    this.service.previewPdf({ formData: this.buildRequest(), formType: form.formType }).subscribe({
      next: result => {
        this.loadingPreview.set(false);
        if (result.hasTemplate && result.pdfBase64) {
          this.previewPdfBase64.set(result.pdfBase64);
          this.reviewPhase.set('preview');
        } else {
          // Server says no template — go straight to signing
          this.reviewPhase.set('signing');
          this.loadSigningUrlForCurrentForm();
        }
      },
      error: () => {
        this.loadingPreview.set(false);
        this.snackbar.error(this.translate.instant('onboarding.errors.previewFailed'));
      },
    });
  }

  // ── Step 2b: create DocuSeal submission, show signing embed ───────────────
  protected loadSigningUrlForCurrentForm(): void {
    const form = this.currentForm();
    if (!form) return;

    this.signingFormInProgress.set(true);
    this.currentSigningUrl.set(null);
    this.service.signForm({ formData: this.buildRequest(), formType: form.formType }).subscribe({
      next: result => {
        this.signingFormInProgress.set(false);
        this.currentSigningUrl.set(result.signingUrl);
        this.reviewPhase.set('signing');
        this.loadDocuSealScript(result.signingUrl);
      },
      error: () => {
        this.signingFormInProgress.set(false);
        this.snackbar.error(this.translate.instant('onboarding.errors.signingFailed'));
      },
    });
  }

  protected proceedToSign(): void {
    this.reviewPhase.set('signing');
    this.loadSigningUrlForCurrentForm();
  }

  protected backToPreview(): void {
    this.reviewPhase.set('preview');
  }

  protected advanceToNextForm(): void {
    const next = this.currentFormIndex() + 1;
    if (next >= this.formsToSign().length) {
      // All forms signed — clear review state. Server-side onboarding draft
      // persists as the authoritative record.
      localStorage.removeItem(REVIEW_STATE_KEY);
      this.signingComplete.set(true);
      this.reviewPhase.set('idle');
    } else {
      this.currentFormIndex.set(next);
      this.currentSigningUrl.set(null);
      this.previewPdfBase64.set(null);
      this.reviewPhase.set('preview');
      this.loadPreviewForCurrentForm();
    }
  }

  /**
   * Drop out of the review/sign flow back into the wizard. Always returns to
   * step 6 (Acknowledgments) — that's where the user was when they hit submit
   * so "back" feels like an undo. From there they can navigate to W-4/I-9/
   * state-withholding via the wizard's Back button if a specific edit is
   * needed. (Previously jumped straight to the form's edit step, which was
   * surprising — reported 2026-05-10.)
   */
  protected goBackToStep(_formType: string | undefined): void {
    this.formsToSign.set([]);
    this.currentFormIndex.set(0);
    this.reviewPhase.set('idle');
    this.previewPdfBase64.set(null);
    this.currentSigningUrl.set(null);
    this.signedFormIndices.set(new Set());
    localStorage.removeItem(REVIEW_STATE_KEY);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: 6, review: null, formIdx: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onDocuSealSubmit(): void {
    const idx = this.currentFormIndex();
    this.signedFormIndices.update((s: Set<number>) => new Set([...s, idx]));
    this.advanceToNextForm();
  }

  private loadDocuSealScript(_signingUrl: string): void {
    if (document.querySelector('script[data-docuseal-embed]')) return;
    // DocuSeal is proxied through /docuseal/ — always load form.js from that
    // same-origin path. Never derive the script origin from the signingUrl value,
    // which would load a script from an arbitrary host.
    const script = document.createElement('script');
    script.src = '/docuseal/js/form.js';
    script.setAttribute('data-docuseal-embed', '');
    script.async = true;
    document.head.appendChild(script);
  }

  protected goToDashboard(): void {
    // Defensive — clear drafts in case the user clicked through before the
    // advanceToNextForm() flush ran (e.g. mock signing returned synchronously).
    localStorage.removeItem(REVIEW_STATE_KEY);
    this.router.navigate([this.layout.getDefaultRoute()]);
  }

  // ── Server-side draft sync ────────────────────────────────────────────────

  /**
   * Patches each form group with the non-sensitive values coming back from
   * GET /onboarding/draft. Sensitive fields (SSN, bank routing/account,
   * I-9 doc numbers) are intentionally left blank — the user re-enters
   * them only if they want to overwrite. The Has* signals drive the
   * "Securely stored" badge + validator relaxation.
   */
  private applyDraftStatus(status: OnboardingDraftStatus): void {
    this.draftStatus.set(status);

    this.personalForm.patchValue({
      firstName:    status.firstName ?? this.personalForm.controls.firstName.value ?? '',
      middleName:   status.middleName ?? '',
      lastName:     status.lastName ?? this.personalForm.controls.lastName.value ?? '',
      dateOfBirth:  status.dateOfBirth ? new Date(status.dateOfBirth) : null,
      email:        status.email ?? this.personalForm.controls.email.value ?? '',
      phone:        status.phone ?? '',
    });
    this.addressForm.patchValue({
      street1:  status.street1 ?? '',
      street2:  status.street2 ?? '',
      city:     status.city ?? '',
      state:    status.addressState ?? null,
      zipCode:  status.zipCode ?? '',
    });

    // W-4 (all plaintext — repopulates verbatim)
    this.w4Form.patchValue({
      filingStatus:           status.w4FilingStatus ?? null,
      multipleJobs:           status.w4MultipleJobs ?? false,
      qualifyingChildren:     status.w4QualifyingChildren ?? null,
      otherDependents:        status.w4OtherDependents ?? null,
      otherIncome:            status.w4OtherIncome ?? null,
      deductions:             status.w4Deductions ?? null,
      extraWithholding:       status.w4ExtraWithholding ?? null,
      exemptFromWithholding:  status.w4ExemptFromWithholding ?? false,
    });

    // State Tax (all plaintext)
    this.stateForm.patchValue({
      stateFilingStatus:           status.stateFilingStatus ?? '',
      stateAllowances:             status.stateAllowances ?? null,
      stateAdditionalWithholding:  status.stateAdditionalWithholding ?? null,
      stateExempt:                 status.stateExempt ?? false,
    });

    // I-9 selections (citizenship is plaintext; doc number stays blank with
    // Has* indicator). setValue on citizenship triggers downstream effects
    // before the rest of the I-9 patch lands — that's intentional.
    if (status.i9CitizenshipStatus) {
      this.i9Form.controls.citizenshipStatus.setValue(status.i9CitizenshipStatus);
    }
    if (status.i9DocumentChoice) {
      this.i9Form.controls.documentChoice.setValue(status.i9DocumentChoice as 'A' | 'BC');
    }
    this.i9Form.patchValue({
      foreignPassportCountry: status.i9ForeignPassportCountry ?? '',
      workAuthExpiry: status.i9WorkAuthExpiry ? new Date(status.i9WorkAuthExpiry) : null,
      listAType:      status.i9ListAType ?? '',
      listAAuthority: status.i9ListAAuthority ?? '',
      listAExpiry:    status.i9ListAExpiry ? new Date(status.i9ListAExpiry) : null,
      listAFileId:    status.i9ListAFileAttachmentId ?? null,
      listBType:      status.i9ListBType ?? '',
      listBAuthority: status.i9ListBAuthority ?? '',
      listBExpiry:    status.i9ListBExpiry ? new Date(status.i9ListBExpiry) : null,
      listBFileId:    status.i9ListBFileAttachmentId ?? null,
      listCType:      status.i9ListCType ?? '',
      listCAuthority: status.i9ListCAuthority ?? '',
      listCExpiry:    status.i9ListCExpiry ? new Date(status.i9ListCExpiry) : null,
      listCFileId:    status.i9ListCFileAttachmentId ?? null,
    });

    // Step 6 — bank name + account type are not sensitive; routing/account
    // come back only as Has* flags.
    this.depositForm.patchValue({
      bankName:    status.bankName ?? '',
      accountType: status.accountType ?? 'Checking',
    });

    // Re-apply the conditional required-validator pass with fresh Has* flags.
    this.applySensitiveValidators();
  }

  /**
   * When the server has already stored a sensitive value (SSN / bank routing /
   * bank account / I-9 doc number), the user's wizard field renders blank
   * with a "Securely stored — re-enter to overwrite" badge. Validators.required
   * must NOT block submission in that case — the encrypted ciphertext is
   * already on the server. The pattern validator stays attached so a
   * non-empty re-entry is still format-validated.
   */
  private applySensitiveValidators(): void {
    this.flipRequired(this.personalForm.controls.ssn,
      [Validators.required, Validators.pattern(/^\d{3}-?\d{2}-?\d{4}$/)],
      [Validators.pattern(/^\d{3}-?\d{2}-?\d{4}$/)],
      this.hasStoredSsn());
    this.flipRequired(this.depositForm.controls.routingNumber,
      [Validators.required, Validators.pattern(/^\d{9}$/)],
      [Validators.pattern(/^\d{9}$/)],
      this.hasStoredBankRouting());
    this.flipRequired(this.depositForm.controls.accountNumber,
      [Validators.required], [], this.hasStoredBankAccount());
    // I-9 doc-number validators are managed by the documentChoice effect; we
    // just toggle required there too based on the corresponding Has* flag.
    if (this.hasStoredListADocNum()) this.i9Form.controls.listADocNumber.clearValidators();
    if (this.hasStoredListBDocNum()) this.i9Form.controls.listBDocNumber.clearValidators();
    if (this.hasStoredListCDocNum()) this.i9Form.controls.listCDocNumber.clearValidators();
    this.i9Form.controls.listADocNumber.updateValueAndValidity({ emitEvent: false });
    this.i9Form.controls.listBDocNumber.updateValueAndValidity({ emitEvent: false });
    this.i9Form.controls.listCDocNumber.updateValueAndValidity({ emitEvent: false });

    // Force each parent FormGroup to re-emit statusChanges so the violations
    // signals subscribed via FormValidationService.getViolations() pick up
    // the relaxed validators. Without this, individual updateValueAndValidity
    // calls with emitEvent:false silently update control.errors but the
    // violation list stays stale ("Social Security Number is required" even
    // with the green Securely-stored badge — reported 2026-05-12).
    this.personalForm.updateValueAndValidity();
    this.depositForm.updateValueAndValidity();
    this.i9Form.updateValueAndValidity();
  }

  private flipRequired(
    ctrl: FormControl<string | null> | FormControl<number | null>,
    requiredValidators: ValidatorFn[],
    optionalValidators: ValidatorFn[],
    isStored: boolean,
  ): void {
    ctrl.clearValidators();
    ctrl.setValidators(isStored ? optionalValidators : requiredValidators);
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Builds the partial draft payload for a single wizard step and POSTs it.
   * Each step contributes only its own fields — null/blank values are
   * filtered so the server preserves existing ciphertext for sensitive
   * fields the user didn't re-enter. Called from nextStep() + the stepper
   * selectionChange handler so every navigation persists progress.
   */
  private saveStepToDraft(stepIndex: number): void {
    let payload: SaveOnboardingDraftRequest;
    switch (stepIndex) {
      case 0: {
        const v = this._personalVal();
        payload = {
          firstName: v.firstName ?? undefined,
          middleName: v.middleName ?? undefined,
          lastName: v.lastName ?? undefined,
          dateOfBirth: v.dateOfBirth ? toIsoDate(v.dateOfBirth) ?? undefined : undefined,
          ssn: v.ssn || undefined, // blank string -> undefined (preserve stored)
          email: v.email ?? undefined,
          phone: v.phone ?? undefined,
        };
        break;
      }
      case 1: {
        const v = this._addressVal();
        payload = {
          street1: v.street1 ?? undefined,
          street2: v.street2 ?? undefined,
          city: v.city ?? undefined,
          addressState: v.state ?? undefined,
          zipCode: v.zipCode ?? undefined,
        };
        break;
      }
      case 2: {
        const v = this._w4Val();
        payload = {
          w4FilingStatus: v.filingStatus ?? undefined,
          w4MultipleJobs: v.multipleJobs ?? undefined,
          w4QualifyingChildren: v.qualifyingChildren ?? undefined,
          w4OtherDependents: v.otherDependents ?? undefined,
          w4OtherIncome: v.otherIncome ?? undefined,
          w4Deductions: v.deductions ?? undefined,
          w4ExtraWithholding: v.extraWithholding ?? undefined,
          w4ExemptFromWithholding: v.exemptFromWithholding ?? undefined,
        };
        break;
      }
      case 3: {
        const v = this._stateVal();
        payload = {
          stateFilingStatus: v.stateFilingStatus || undefined,
          stateAllowances: v.stateAllowances ?? undefined,
          stateAdditionalWithholding: v.stateAdditionalWithholding ?? undefined,
          stateExempt: v.stateExempt ?? undefined,
        };
        break;
      }
      case 4: {
        const v = this._i9Val();
        payload = {
          i9CitizenshipStatus: v.citizenshipStatus || undefined,
          i9AlienRegNumber: v.alienRegNumber || undefined,
          i9I94Number: v.i94Number || undefined,
          i9ForeignPassportNumber: v.foreignPassportNumber || undefined,
          i9ForeignPassportCountry: v.foreignPassportCountry || undefined,
          i9WorkAuthExpiry: v.workAuthExpiry ? toIsoDate(v.workAuthExpiry) ?? undefined : undefined,
          i9DocumentChoice: v.documentChoice ?? undefined,
          i9ListAType: v.listAType ?? undefined,
          i9ListADocNumber: v.listADocNumber || undefined,
          i9ListAAuthority: v.listAAuthority ?? undefined,
          i9ListAExpiry: v.listAExpiry ? toIsoDate(v.listAExpiry) ?? undefined : undefined,
          i9ListAFileAttachmentId: v.listAFileId ?? undefined,
          i9ListBType: v.listBType ?? undefined,
          i9ListBDocNumber: v.listBDocNumber || undefined,
          i9ListBAuthority: v.listBAuthority ?? undefined,
          i9ListBExpiry: v.listBExpiry ? toIsoDate(v.listBExpiry) ?? undefined : undefined,
          i9ListBFileAttachmentId: v.listBFileId ?? undefined,
          i9ListCType: v.listCType ?? undefined,
          i9ListCDocNumber: v.listCDocNumber || undefined,
          i9ListCAuthority: v.listCAuthority ?? undefined,
          i9ListCExpiry: v.listCExpiry ? toIsoDate(v.listCExpiry) ?? undefined : undefined,
          i9ListCFileAttachmentId: v.listCFileId ?? undefined,
        };
        break;
      }
      case 5: {
        const v = this._depositVal();
        payload = {
          bankName: v.bankName ?? undefined,
          routingNumber: v.routingNumber || undefined,
          accountNumber: v.accountNumber || undefined,
          accountType: v.accountType ?? undefined,
        };
        break;
      }
      default:
        return; // W-4 / state / ack steps have no server-side draft target
    }
    this.service.saveDraft(payload).subscribe({
      next: status => this.draftStatus.set(status),
      error: () => {}, // Non-fatal — user can retry on next nav
    });
  }

  /**
   * Restore the per-form review/signing state from localStorage so a page
   * refresh during the e-sign loop puts the user back into the review flow
   * instead of the (now empty) wizard stepper.
   *
   * URL params (`?review`, `?formIdx`) take priority over the persisted
   * snapshot for phase + form index — that's how a shared link picks the
   * right form/screen. The formsToSign list comes from localStorage either
   * way (it's too large for the URL).
   */
  private restoreReviewState(): void {
    try {
      const raw = localStorage.getItem(REVIEW_STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as PersistedReviewState;
      if (!state.formsToSign || state.formsToSign.length === 0) return;

      const urlParams = this.route.snapshot.queryParamMap;
      const urlReview = urlParams.get('review');
      const urlFormIdx = parseInt(urlParams.get('formIdx') ?? '', 10);

      const phase: 'idle' | 'preview' | 'signing' =
        urlReview === 'preview' || urlReview === 'signing'
          ? urlReview
          : (state.reviewPhase ?? 'preview');
      const formIdx = !isNaN(urlFormIdx)
        ? Math.min(Math.max(urlFormIdx, 0), state.formsToSign.length - 1)
        : Math.min(state.currentFormIndex ?? 0, state.formsToSign.length - 1);

      this.formsToSign.set(state.formsToSign);
      this.currentFormIndex.set(formIdx);
      this.signedFormIndices.set(new Set(state.signedFormIndices ?? []));
      this.reviewPhase.set(phase);

      // Kick off whatever phase we restored into so the relevant data loads.
      if (phase === 'preview') {
        this.loadPreviewForCurrentForm();
      } else if (phase === 'signing') {
        this.loadSigningUrlForCurrentForm();
      }
    } catch {
      // Corrupt state — drop it so the next session starts clean
      localStorage.removeItem(REVIEW_STATE_KEY);
    }
  }
}
