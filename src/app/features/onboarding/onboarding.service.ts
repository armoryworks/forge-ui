import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface OnboardingSubmitRequest {
  // Step 1: Personal
  firstName: string;
  middleName?: string;
  lastName: string;
  otherLastNames?: string;
  dateOfBirth: string;
  ssn: string;
  email: string;
  phone: string;
  // Step 2: Address
  street1: string;
  street2?: string;
  city: string;
  addressState: string;
  zipCode: string;
  // Step 3: W-4
  w4FilingStatus: string;
  w4MultipleJobs: boolean;
  w4ClaimDependentsAmount: number;
  w4OtherIncome: number;
  w4Deductions: number;
  w4ExtraWithholding: number;
  w4ExemptFromWithholding: boolean;
  // Step 4: State withholding
  stateFilingStatus?: string;
  stateAllowances?: number;
  stateAdditionalWithholding?: number;
  stateExempt?: boolean;
  // Step 5: I-9 citizenship
  i9CitizenshipStatus: string;
  i9AlienRegNumber?: string;
  i9I94Number?: string;
  i9ForeignPassportNumber?: string;
  i9ForeignPassportCountry?: string;
  i9WorkAuthExpiry?: string;
  i9PreparedByPreparer: boolean;
  i9PreparerFirstName?: string;
  i9PreparerLastName?: string;
  i9PreparerAddress?: string;
  i9PreparerCity?: string;
  i9PreparerState?: string;
  i9PreparerZip?: string;
  // I-9 document verification (optional pre-upload; physical docs required on day 1)
  i9DocumentChoice?: string;
  i9ListAType?: string;
  i9ListADocNumber?: string;
  i9ListAAuthority?: string;
  i9ListAExpiry?: string;
  i9ListAFileAttachmentId?: number;
  i9ListBType?: string;
  i9ListBDocNumber?: string;
  i9ListBAuthority?: string;
  i9ListBExpiry?: string;
  i9ListBFileAttachmentId?: number;
  i9ListCType?: string;
  i9ListCDocNumber?: string;
  i9ListCAuthority?: string;
  i9ListCExpiry?: string;
  i9ListCFileAttachmentId?: number;
  // Step 6: Direct deposit
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: string;
  voidedCheckFileAttachmentId?: number;
  // Step 7: Acknowledgments
  acknowledgeWorkersComp: boolean;
  acknowledgeHandbook: boolean;
}

export interface OnboardingSigningUrl {
  formType: string;
  formName: string;
  signingUrl: string;
  submissionId: number;
}

export interface OnboardingSubmitResult {
  requiresSigning: boolean;
  signingUrls: OnboardingSigningUrl[];
  i9EmployerDocuSealSubmitterId: number | null;
}

export interface OnboardingStatus {
  w4Complete: boolean;
  i9Complete: boolean;
  stateWithholdingComplete: boolean;
  directDepositComplete: boolean;
  workersCompComplete: boolean;
  handbookComplete: boolean;
  allComplete: boolean;
  canBeAssigned: boolean;
}

export interface UploadI9DocumentResult {
  fileAttachmentId: number;
  fileName: string;
}

export interface OnboardingPolicyDocs {
  workersCompDocUrl: string | null;
  handbookDocUrl: string | null;
}

/**
 * Partial onboarding-draft request. Mirror of OnboardingSubmitRequest with
 * every field optional — the server upserts whatever's non-null. Sensitive
 * identifiers (SSN, bank routing/account, I-9 doc numbers) are encrypted at
 * rest server-side; passing null preserves the existing ciphertext.
 */
export interface SaveOnboardingDraftRequest {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  ssn?: string;
  email?: string;
  phone?: string;
  street1?: string;
  street2?: string;
  city?: string;
  addressState?: string;
  zipCode?: string;
  i9DocumentChoice?: string;
  i9ListAType?: string;
  i9ListADocNumber?: string;
  i9ListAAuthority?: string;
  i9ListAExpiry?: string;
  i9ListAFileAttachmentId?: number;
  i9ListBType?: string;
  i9ListBDocNumber?: string;
  i9ListBAuthority?: string;
  i9ListBExpiry?: string;
  i9ListBFileAttachmentId?: number;
  i9ListCType?: string;
  i9ListCDocNumber?: string;
  i9ListCAuthority?: string;
  i9ListCExpiry?: string;
  i9ListCFileAttachmentId?: number;
  bankName?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountType?: string;
}

/**
 * Echoed draft state from GET /onboarding/draft. Sensitive identifiers are
 * NEVER returned as plaintext or ciphertext — only a Has* boolean signals
 * that something is stored. The wizard uses these flags to render a
 * "Securely stored — re-enter to overwrite" badge next to fields that are
 * intentionally blank for security.
 */
export interface OnboardingDraftStatus {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  hasSsn: boolean;

  street1: string | null;
  street2: string | null;
  city: string | null;
  addressState: string | null;
  zipCode: string | null;

  i9DocumentChoice: string | null;
  i9ListAType: string | null;
  i9ListAAuthority: string | null;
  i9ListAExpiry: string | null;
  i9ListAFileAttachmentId: number | null;
  hasListADocNumber: boolean;
  i9ListBType: string | null;
  i9ListBAuthority: string | null;
  i9ListBExpiry: string | null;
  i9ListBFileAttachmentId: number | null;
  hasListBDocNumber: boolean;
  i9ListCType: string | null;
  i9ListCAuthority: string | null;
  i9ListCExpiry: string | null;
  i9ListCFileAttachmentId: number | null;
  hasListCDocNumber: boolean;

  bankName: string | null;
  accountType: string | null;
  hasBankRouting: boolean;
  hasBankAccount: boolean;
}

// ── Per-form review flow models ───────────────────────────────────────────────

export interface OnboardingFormToSignItem {
  formType: string;
  formName: string;
  hasTemplate: boolean;
}

export interface SaveOnboardingResult {
  formsToSign: OnboardingFormToSignItem[];
}

export interface PreviewOnboardingPdfRequest {
  formData: OnboardingSubmitRequest;
  formType: string;
}

export interface PreviewOnboardingPdfResult {
  hasTemplate: boolean;
  pdfBase64: string | null;
}

export interface SignOnboardingFormRequest {
  formData: OnboardingSubmitRequest;
  formType: string;
}

export interface SignOnboardingFormResult {
  signingUrl: string;
  submissionId: number;
  isMock: boolean;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/onboarding`;

  private readonly _status = signal<OnboardingStatus | null>(null);
  readonly status = this._status.asReadonly();

  loadStatus(): void {
    this.http.get<OnboardingStatus>(`${this.base}/status`).subscribe(s => this._status.set(s));
  }

  submit(request: OnboardingSubmitRequest): Observable<OnboardingSubmitResult> {
    return this.http.post<OnboardingSubmitResult>(`${this.base}/submit`, request).pipe(
      tap(() => this.loadStatus()),
    );
  }

  uploadI9Document(file: File, documentList: string): Observable<UploadI9DocumentResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentList', documentList);
    return this.http.post<UploadI9DocumentResult>(`${this.base}/i9-document`, formData);
  }

  uploadVoidedCheck(file: File): Observable<UploadI9DocumentResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadI9DocumentResult>(`${this.base}/voided-check`, formData);
  }

  /** Workers' comp + handbook document URLs surfaced on the Acknowledgments step. */
  getPolicyDocs(): Observable<OnboardingPolicyDocs> {
    return this.http.get<OnboardingPolicyDocs>(`${this.base}/policy-docs`);
  }

  /**
   * Server-side draft (replaces the old localStorage draft for sensitive
   * data). Sends a partial — only fields the caller wants to update — and
   * gets back the canonical status (Has* booleans for sensitive fields).
   */
  saveDraft(request: SaveOnboardingDraftRequest): Observable<OnboardingDraftStatus> {
    return this.http.post<OnboardingDraftStatus>(`${this.base}/draft`, request);
  }

  /** Loads the current server-side draft status for the calling user. */
  getDraft(): Observable<OnboardingDraftStatus> {
    return this.http.get<OnboardingDraftStatus>(`${this.base}/draft`);
  }

  // ── Per-form review flow ──────────────────────────────────────────────────

  /** Persist profile data, identity docs, and acknowledgments. Returns forms to sign. */
  saveData(request: OnboardingSubmitRequest): Observable<SaveOnboardingResult> {
    return this.http.post<SaveOnboardingResult>(`${this.base}/save`, request).pipe(
      tap(() => this.loadStatus()),
    );
  }

  /** Fill a single form PDF server-side, return base64 for inline preview. */
  previewPdf(request: PreviewOnboardingPdfRequest): Observable<PreviewOnboardingPdfResult> {
    return this.http.post<PreviewOnboardingPdfResult>(`${this.base}/preview-pdf`, request);
  }

  /** Fill a single form PDF and create a DocuSeal submission. Returns signing URL. */
  signForm(request: SignOnboardingFormRequest): Observable<SignOnboardingFormResult> {
    return this.http.post<SignOnboardingFormResult>(`${this.base}/sign-form`, request).pipe(
      tap(() => this.loadStatus()),
    );
  }

  /** Self-certify onboarding complete without going through the wizard. */
  bypass(): Observable<void> {
    return this.http.post<void>(`${this.base}/bypass`, null).pipe(
      tap(() => this.loadStatus()),
    );
  }
}
