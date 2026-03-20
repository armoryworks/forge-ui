import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, switchMap, catchError, of } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '../../../../../environments/environment';
import { SearchResult } from '../../../../shared/models/search.model';

@Component({
  selector: 'app-kiosk-search-bar',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './kiosk-search-bar.component.html',
  styleUrl: './kiosk-search-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskSearchBarComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  protected readonly searchControl = new FormControl('');
  protected readonly results = signal<SearchResult[]>([]);
  protected readonly showResults = signal(false);

  constructor() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => (v?.length ?? 0) >= 2),
      switchMap(term => this.http.get<SearchResult[]>(
        `${environment.apiUrl}/display/shop-floor/search`,
        { params: { q: term!, limit: '10' } },
      ).pipe(catchError(() => of([])))),
    ).subscribe(results => {
      this.results.set(results);
      this.showResults.set(results.length > 0);
    });

    this.searchControl.valueChanges.pipe(
      filter(v => !v || v.length < 2),
    ).subscribe(() => {
      this.results.set([]);
      this.showResults.set(false);
    });
  }

  protected onFocus(): void {
    if (this.results().length > 0) {
      this.showResults.set(true);
    }
  }

  protected onBlur(): void {
    setTimeout(() => this.showResults.set(false), 200);
  }

  protected navigateTo(result: SearchResult): void {
    this.showResults.set(false);
    this.searchControl.setValue('', { emitEvent: false });
    this.results.set([]);
    this.router.navigateByUrl(result.url);
  }
}
