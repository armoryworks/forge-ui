import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { DepreciationPreview } from '../models/depreciation-preview.model';
import { DepreciationRunResult } from '../models/depreciation-run-result.model';
import { FixedAsset } from '../models/fixed-asset.model';
import { FixedAssetDetail } from '../models/fixed-asset-detail.model';
import { DisposeFixedAssetInput, FixedAssetDisposalPreview, FixedAssetDisposalResult } from '../models/fixed-asset-disposal.model';
import { FixedAssetInput } from '../models/fixed-asset-input.model';
import { LinkableAsset } from '../models/linkable-asset.model';

/**
 * Fixed-asset register, depreciation and disposal (`/api/v1/accounting/fixed-assets`, `/depreciation`).
 * Controller only; gated server-side and in the capability registry on CAP-ACCT-DEPRECIATION.
 */
@Injectable({ providedIn: 'root' })
export class FixedAssetService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting`;

  list(bookId: number): Observable<FixedAsset[]> {
    return this.http.get<FixedAsset[]>(`${this.base}/fixed-assets`, { params: new HttpParams().set('bookId', bookId) });
  }

  get(id: number): Observable<FixedAssetDetail> {
    return this.http.get<FixedAssetDetail>(`${this.base}/fixed-assets/${id}`);
  }

  create(input: FixedAssetInput): Observable<FixedAsset> {
    return this.http.post<FixedAsset>(`${this.base}/fixed-assets`, input);
  }

  update(id: number, input: FixedAssetInput): Observable<FixedAssetDetail> {
    return this.http.put<FixedAssetDetail>(`${this.base}/fixed-assets/${id}`, input);
  }

  linkableAssets(bookId: number): Observable<LinkableAsset[]> {
    return this.http.get<LinkableAsset[]>(`${this.base}/fixed-assets/linkable-assets`, {
      params: new HttpParams().set('bookId', bookId),
    });
  }

  previewDepreciation(bookId: number, periodMonth: string): Observable<DepreciationPreview> {
    return this.http.post<DepreciationPreview>(`${this.base}/depreciation/preview`, { bookId, periodMonth });
  }

  runDepreciation(bookId: number, periodMonth: string): Observable<DepreciationRunResult> {
    return this.http.post<DepreciationRunResult>(`${this.base}/depreciation/run`, { bookId, periodMonth });
  }

  previewDisposal(id: number, disposalDate: string, proceeds: number): Observable<FixedAssetDisposalPreview> {
    return this.http.post<FixedAssetDisposalPreview>(`${this.base}/fixed-assets/${id}/dispose/preview`, { disposalDate, proceeds });
  }

  dispose(id: number, input: DisposeFixedAssetInput): Observable<FixedAssetDisposalResult> {
    return this.http.post<FixedAssetDisposalResult>(`${this.base}/fixed-assets/${id}/dispose`, input);
  }
}
