import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SelectOption } from '../components/select/select.component';

export interface ReferenceDataItem {
  id: number;
  groupCode: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  metadata?: string;
}

export interface RoleItem {
  name: string;
}

@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, ReferenceDataItem[]>();
  private readonly rolesCache = signal<RoleItem[] | null>(null);

  /** Load reference data items by group code (cached). */
  getByGroup(groupCode: string): Observable<ReferenceDataItem[]> {
    const cached = this.cache.get(groupCode);
    if (cached) return of(cached);

    return this.http.get<ReferenceDataItem[]>(
      `${environment.apiUrl}/reference-data/${groupCode}`,
    ).pipe(
      tap(items => this.cache.set(groupCode, items)),
    );
  }

  /**
   * Get reference data items as SelectOption[].
   * @param groupCode — the reference data group
   * @param opts.allLabel — prepend a null "all" entry with this label
   * @param opts.valueField — which field to use as option value: 'code' (default) or 'label'
   */
  getAsOptions(groupCode: string, opts?: { allLabel?: string; valueField?: 'code' | 'label' }): Observable<SelectOption[]> {
    const valueField = opts?.valueField ?? 'code';
    return new Observable<SelectOption[]>(subscriber => {
      this.getByGroup(groupCode).subscribe({
        next: items => {
          const options: SelectOption[] = items
            .filter(i => i.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(i => ({ value: i[valueField], label: i.label }));
          if (opts?.allLabel) {
            options.unshift({ value: null, label: opts.allLabel });
          }
          subscriber.next(options);
          subscriber.complete();
        },
        error: err => subscriber.error(err),
      });
    });
  }

  /** Load identity roles (cached). */
  getRoles(): Observable<RoleItem[]> {
    const cached = this.rolesCache();
    if (cached) return of(cached);

    return this.http.get<RoleItem[]>(
      `${environment.apiUrl}/admin/roles`,
    ).pipe(
      tap(roles => this.rolesCache.set(roles)),
    );
  }

  /** Get roles as SelectOption[] (with optional null "all" entry). */
  getRolesAsOptions(allLabel?: string): Observable<SelectOption[]> {
    return new Observable<SelectOption[]>(subscriber => {
      this.getRoles().subscribe({
        next: roles => {
          const options: SelectOption[] = roles.map(r => ({ value: r.name, label: r.name }));
          if (allLabel) {
            options.unshift({ value: null, label: allLabel });
          }
          subscriber.next(options);
          subscriber.complete();
        },
        error: err => subscriber.error(err),
      });
    });
  }

  /** Clear all cached data (e.g., after admin edits reference data). */
  clearCache(): void {
    this.cache.clear();
    this.rolesCache.set(null);
  }

  /** Clear a specific group's cache. */
  clearGroupCache(groupCode: string): void {
    this.cache.delete(groupCode);
  }
}
