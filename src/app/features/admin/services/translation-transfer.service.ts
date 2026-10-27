import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, forkJoin, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ImportTranslationsResult } from '../models/import-translations-result.model';
import { TranslationImportChange } from '../models/translation-import-change.model';
import { I18nLabelService } from './i18n-label.service';
import { flattenCatalog } from '../languages/translation-transfer.utils';

@Injectable({ providedIn: 'root' })
export class TranslationTransferService {
  private readonly http = inject(HttpClient);
  private readonly labels = inject(I18nLabelService);

  /** The shipped catalog and the live overrides for one language, both flattened to dotted keys. */
  load(languageCode: string): Observable<{ shipped: Record<string, string>; overrides: Record<string, string> }> {
    return forkJoin({ catalog: this.labels.baseCatalog(languageCode), overrides: this.labels.list() }).pipe(
      map(({ catalog, overrides }) => ({
        shipped: flattenCatalog(catalog),
        overrides: Object.fromEntries(
          overrides
            .filter(o => o.languageCode === languageCode && !o.isPendingTranslation)
            .map(o => [o.key, o.value])),
      })));
  }

  import(languageCode: string, changes: TranslationImportChange[]): Observable<ImportTranslationsResult> {
    return this.http.post<ImportTranslationsResult>(`${environment.apiUrl}/i18n/overrides/import`, {
      languageCode,
      entries: changes.map(c => ({ key: c.key, value: c.newValue, shippedValue: c.shippedValue })),
    });
  }
}
