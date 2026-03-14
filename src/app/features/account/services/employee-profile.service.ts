import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';

export interface EmployeeProfile {
  id: number;
  userId: number;
  dateOfBirth: string | null;
  gender: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  phoneNumber: string | null;
  personalEmail: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  startDate: string | null;
  department: string | null;
  jobTitle: string | null;
  employeeNumber: string | null;
  payType: string | null;
  hourlyRate: number | null;
  salaryAmount: number | null;
  w4CompletedAt: string | null;
  stateWithholdingCompletedAt: string | null;
  i9CompletedAt: string | null;
  i9ExpirationDate: string | null;
  directDepositCompletedAt: string | null;
  workersCompAcknowledgedAt: string | null;
  handbookAcknowledgedAt: string | null;
}

export interface UpdateEmployeeProfileRequest {
  dateOfBirth: string | null;
  gender: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  phoneNumber: string | null;
  personalEmail: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
}

export interface ProfileCompletenessItem {
  key: string;
  label: string;
  isComplete: boolean;
  blocksJobAssignment: boolean;
}

export interface ProfileCompleteness {
  isComplete: boolean;
  canBeAssignedJobs: boolean;
  totalItems: number;
  completedItems: number;
  items: ProfileCompletenessItem[];
}

@Injectable({ providedIn: 'root' })
export class EmployeeProfileService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/employee-profile`;

  private readonly _profile = signal<EmployeeProfile | null>(null);
  private readonly _completeness = signal<ProfileCompleteness | null>(null);

  readonly profile = this._profile.asReadonly();
  readonly completeness = this._completeness.asReadonly();
  readonly isComplete = computed(() => this._completeness()?.isComplete ?? false);
  readonly incompleteCount = computed(() => {
    const c = this._completeness();
    return c ? c.totalItems - c.completedItems : 0;
  });

  readonly canBeAssignedJobs = computed(() => this._completeness()?.canBeAssignedJobs ?? false);

  private static readonly KEY_ROUTE_MAP: Record<string, string> = {
    address: '/account/contact',
    emergency_contact: '/account/emergency',
    w4: '/account/tax-forms/w4',
    i9: '/account/tax-forms/i9',
    stateWithholding: '/account/tax-forms/stateWithholding',
    directDeposit: '/account/tax-forms/directDeposit',
    workersComp: '/account/tax-forms/workersComp',
    handbook: '/account/tax-forms/handbook',
  };

  readonly firstIncompleteRoute = computed(() => {
    const c = this._completeness();
    if (!c) return '/account/profile';
    const first = c.items.find(i => !i.isComplete);
    return first ? (EmployeeProfileService.KEY_ROUTE_MAP[first.key] ?? '/account/profile') : '/account/profile';
  });

  load(): void {
    this.http.get<EmployeeProfile>(this.base).subscribe(p => this._profile.set(p));
    this.http.get<ProfileCompleteness>(`${this.base}/completeness`).subscribe(c => this._completeness.set(c));
  }

  updateProfile(data: UpdateEmployeeProfileRequest): Observable<EmployeeProfile> {
    return this.http.put<EmployeeProfile>(this.base, data).pipe(
      tap(p => {
        this._profile.set(p);
        this.refreshCompleteness();
      }),
    );
  }

  acknowledgeForm(formType: string): Observable<void> {
    return this.http.post<void>(`${this.base}/acknowledge/${formType}`, {}).pipe(
      tap(() => {
        this.refreshCompleteness();
        this.http.get<EmployeeProfile>(this.base).subscribe(p => this._profile.set(p));
      }),
    );
  }

  private refreshCompleteness(): void {
    this.http.get<ProfileCompleteness>(`${this.base}/completeness`).subscribe(c => this._completeness.set(c));
  }
}
