import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, filter, switchMap, catchError, of, Subscription } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '../../../../../environments/environment';
import { SearchResult } from '../../../../shared/models/search.model';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { JobStatus } from '../../../../shared/models/mobile-api.model';
import { ShopFloorService } from '../../services/shop-floor.service';

@Component({
  selector: 'app-kiosk-search-bar',
  standalone: true,
  imports: [DateOnlyPipe, ReactiveFormsModule, TranslatePipe],
  templateUrl: './kiosk-search-bar.component.html',
  styleUrl: './kiosk-search-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskSearchBarComponent {
  private readonly http = inject(HttpClient);
  private readonly shopFloorService = inject(ShopFloorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly searchControl = new FormControl('');
  protected readonly results = signal<SearchResult[]>([]);
  protected readonly showResults = signal(false);
  protected readonly selected = signal<SearchResult | null>(null);
  protected readonly jobStatus = signal<JobStatus | null>(null);
  protected readonly jobStatusLoading = signal(false);
  protected readonly jobStatusFailed = signal(false);

  private jobStatusSub: Subscription | null = null;

  constructor() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => (v?.length ?? 0) >= 2),
      switchMap(term => this.http.get<SearchResult[]>(
        `${environment.apiUrl}/display/shop-floor/search`,
        { params: { q: term!, limit: '10' } },
      ).pipe(catchError(() => of([])))),
      takeUntilDestroyed(),
    ).subscribe(results => {
      this.results.set(results);
      this.showResults.set(results.length > 0);
    });

    this.searchControl.valueChanges.pipe(
      filter(() => this.selected() !== null),
      takeUntilDestroyed(),
    ).subscribe(() => this.close());

    this.searchControl.valueChanges.pipe(
      filter(v => !v || v.length < 2),
      takeUntilDestroyed(),
    ).subscribe(() => {
      this.results.set([]);
      this.showResults.set(false);
    });
  }

  protected onFocus(): void {
    this.close();
    if (this.results().length > 0) {
      this.showResults.set(true);
    }
  }

  protected onBlur(): void {
    setTimeout(() => this.showResults.set(false), 200);
  }

  protected select(result: SearchResult): void {
    this.showResults.set(false);
    this.searchControl.setValue('', { emitEvent: false });
    this.results.set([]);
    this.selected.set(result);
    this.loadJobStatus(result);
  }

  protected isJob(result: SearchResult): boolean {
    return result.entityType === 'Job';
  }

  protected close(): void {
    this.jobStatusSub?.unsubscribe();
    this.jobStatusSub = null;
    this.selected.set(null);
    this.jobStatus.set(null);
    this.jobStatusLoading.set(false);
    this.jobStatusFailed.set(false);
  }

  private loadJobStatus(result: SearchResult): void {
    this.jobStatusSub?.unsubscribe();
    this.jobStatus.set(null);
    this.jobStatusFailed.set(false);
    if (!this.isJob(result)) {
      this.jobStatusLoading.set(false);
      return;
    }
    this.jobStatusLoading.set(true);
    this.jobStatusSub = this.shopFloorService.getJobStatus(result.entityId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: status => {
        this.jobStatus.set(status);
        this.jobStatusLoading.set(false);
      },
      error: () => {
        this.jobStatusFailed.set(true);
        this.jobStatusLoading.set(false);
      },
    });
  }
}
