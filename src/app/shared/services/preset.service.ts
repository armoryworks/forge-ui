import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PresetApplyPreview,
  PresetApplyResult,
  PresetCompareResponse,
  PresetCustomOverride,
  PresetCustomPreview,
  PresetDetail,
  PresetSummary,
} from '../models/preset.model';

/**
 * Phase 4 Phase-G — Preset browser API client + state.
 *
 * Loads the catalog of 8 presets, fetches per-preset detail (with deltas),
 * runs the compare matrix, previews applies, and commits applies. Mirrors
 * the structure of `DiscoveryService` (Phase F) so the two surfaces share
 * a familiar shape.
 */
@Injectable({ providedIn: 'root' })
export class PresetService {
  private readonly http = inject(HttpClient);

  private readonly _presets = signal<PresetSummary[]>([]);
  private readonly _selected = signal<PresetDetail | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _detailLoading = signal<boolean>(false);
  private readonly _previewing = signal<boolean>(false);
  private readonly _applying = signal<boolean>(false);
  private readonly _comparing = signal<boolean>(false);

  readonly presets = this._presets.asReadonly();
  readonly selected = this._selected.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly previewing = this._previewing.asReadonly();
  readonly applying = this._applying.asReadonly();
  readonly comparing = this._comparing.asReadonly();

  loadPresets(): Observable<PresetSummary[]> {
    this._loading.set(true);
    return this.http.get<PresetSummary[]>(`${environment.apiUrl}/presets`).pipe(
      tap((res) => {
        this._presets.set(res);
        this._loading.set(false);
      }),
    );
  }

  getPreset(id: string): Observable<PresetDetail> {
    this._detailLoading.set(true);
    return this.http
      .get<PresetDetail>(`${environment.apiUrl}/presets/${encodeURIComponent(id)}`)
      .pipe(
        tap((res) => {
          this._selected.set(res);
          this._detailLoading.set(false);
        }),
      );
  }

  compare(presetIds: string[]): Observable<PresetCompareResponse> {
    this._comparing.set(true);
    return this.http
      .post<PresetCompareResponse>(`${environment.apiUrl}/presets/compare`, { presetIds })
      .pipe(
        tap(() => {
          this._comparing.set(false);
        }),
      );
  }

  previewApply(id: string): Observable<PresetApplyPreview> {
    this._previewing.set(true);
    return this.http
      .post<PresetApplyPreview>(
        `${environment.apiUrl}/presets/${encodeURIComponent(id)}/preview-apply`,
        {},
      )
      .pipe(
        tap(() => {
          this._previewing.set(false);
        }),
      );
  }

  apply(id: string, reason?: string): Observable<PresetApplyResult> {
    this._applying.set(true);
    return this.http
      .post<PresetApplyResult>(
        `${environment.apiUrl}/presets/${encodeURIComponent(id)}/apply`,
        { reason: reason ?? null },
      )
      .pipe(
        tap(() => {
          this._applying.set(false);
        }),
      );
  }

  previewCustom(overrides: PresetCustomOverride[]): Observable<PresetCustomPreview> {
    this._previewing.set(true);
    return this.http
      .post<PresetCustomPreview>(`${environment.apiUrl}/presets/custom/preview`, {
        capabilityOverrides: overrides,
      })
      .pipe(
        tap(() => {
          this._previewing.set(false);
        }),
      );
  }

  applyCustom(overrides: PresetCustomOverride[], reason?: string): Observable<PresetApplyResult> {
    this._applying.set(true);
    return this.http
      .post<PresetApplyResult>(`${environment.apiUrl}/presets/custom/apply`, {
        capabilityOverrides: overrides,
        reason: reason ?? null,
      })
      .pipe(
        tap(() => {
          this._applying.set(false);
        }),
      );
  }
}
