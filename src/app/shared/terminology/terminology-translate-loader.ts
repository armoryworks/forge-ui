import { Injectable, inject } from '@angular/core';
import { TranslationObject } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { forkJoin, from, map, Observable, of, switchMap, tap } from 'rxjs';

import { TermSetStore } from './term-set.store';
import { TranslationTree } from './term-substitution';

/**
 * HTTP catalog loader that keeps the shipped catalog for each language and
 * hands ngx-translate the term-substituted version, so every `| translate`,
 * `translate.instant()` and `[translate]` lookup shows the install's
 * terminology without touching templates.
 */
@Injectable()
export class TerminologyTranslateLoader extends TranslateHttpLoader {
  private readonly terms = inject(TermSetStore);

  override getTranslation(lang: string): Observable<TranslationObject> {
    const own$ = this.fetchPristine(lang);
    const gate$ = this.terms.needsGate(lang) && !this.terms.hasPristine('en') ? this.fetchPristine('en') : of(null);
    return forkJoin([own$, gate$]).pipe(
      switchMap(() => from(this.terms.compose(lang))),
      map(composed => (composed ?? {}) as TranslationObject),
    );
  }

  fetchPristine(lang: string): Observable<TranslationTree> {
    return super.getTranslation(lang).pipe(
      map(catalog => catalog as TranslationTree),
      tap(catalog => this.terms.setPristine(lang, catalog)),
    );
  }
}
