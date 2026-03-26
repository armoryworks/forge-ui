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
  // Step 5: I-9
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
  // Step 6: Direct deposit
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: string;
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
}
