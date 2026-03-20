import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ComplianceFormTemplate,
  ComplianceFormSubmission,
  ComplianceFormType,
  IdentityDocument,
  IdentityDocumentType,
  StateFormDefinitionResult,
} from '../models/compliance-form.model';

@Injectable({ providedIn: 'root' })
export class ComplianceFormService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/compliance-forms`;
  private readonly identityBase = `${environment.apiUrl}/identity-documents`;

  private readonly _templates = signal<ComplianceFormTemplate[]>([]);
  private readonly _submissions = signal<ComplianceFormSubmission[]>([]);
  private readonly _identityDocuments = signal<IdentityDocument[]>([]);

  readonly templates = this._templates.asReadonly();
  readonly submissions = this._submissions.asReadonly();
  readonly identityDocuments = this._identityDocuments.asReadonly();

  loadTemplates(): void {
    this.http.get<ComplianceFormTemplate[]>(this.base).subscribe(t => this._templates.set(t));
  }

  loadMySubmissions(): void {
    this.http.get<ComplianceFormSubmission[]>(`${this.base}/submissions/me`).subscribe(s => this._submissions.set(s));
  }

  getSubmissionByType(formType: ComplianceFormType): Observable<ComplianceFormSubmission> {
    return this.http.get<ComplianceFormSubmission>(`${this.base}/submissions/me/${formType}`);
  }

  createSubmission(templateId: number): Observable<ComplianceFormSubmission> {
    return this.http.post<ComplianceFormSubmission>(`${this.base}/${templateId}/submit`, {}).pipe(
      tap(() => this.loadMySubmissions()),
    );
  }

  saveFormData(templateId: number, formDataJson: string, formDefinitionVersionId?: number | null): Observable<ComplianceFormSubmission> {
    return this.http.put<ComplianceFormSubmission>(
      `${this.base}/${templateId}/form-data`,
      { formDataJson, formDefinitionVersionId },
    ).pipe(
      tap(() => this.loadMySubmissions()),
    );
  }

  submitFormData(templateId: number, formDataJson: string, formDefinitionVersionId?: number | null): Observable<ComplianceFormSubmission> {
    return this.http.post<ComplianceFormSubmission>(
      `${this.base}/${templateId}/submit-form`,
      { formDataJson, formDefinitionVersionId },
    ).pipe(
      tap(() => this.loadMySubmissions()),
    );
  }

  getMyStateDefinition(): Observable<StateFormDefinitionResult> {
    return this.http.get<StateFormDefinitionResult>(`${this.base}/my-state-definition`);
  }

  loadMyIdentityDocuments(): void {
    this.http.get<IdentityDocument[]>(`${this.identityBase}/me`).subscribe(d => this._identityDocuments.set(d));
  }

  uploadIdentityDocument(
    documentType: IdentityDocumentType,
    expiresAt: string | null,
    fileAttachmentId: number,
  ): Observable<IdentityDocument> {
    return this.http.post<IdentityDocument>(
      `${this.identityBase}/me?fileAttachmentId=${fileAttachmentId}`,
      { documentType, expiresAt },
    ).pipe(
      tap(() => this.loadMyIdentityDocuments()),
    );
  }

  deleteIdentityDocument(id: number): Observable<void> {
    return this.http.delete<void>(`${this.identityBase}/me/${id}`).pipe(
      tap(() => this.loadMyIdentityDocuments()),
    );
  }
}
