import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { TrainingComponent } from './training.component';
import { TrainingService } from './services/training.service';
import { SelectOption } from '../../shared/components/select/select.component';

interface TrainingInternals {
  contentTypeControl: { setValue(v: string): void };
  learningStyleControl: { setValue(v: string): void; value: string | null };
  searchControl: { setValue(v: string): void; value: string | null };
  learningStyleOptions(): SelectOption[];
  hasActiveFilters(): boolean;
  clearFilters(): void;
}

describe('TrainingComponent filters', () => {
  function create(): TrainingInternals {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: TrainingService, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ tab: 'all-modules' })) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new TrainingComponent()) as unknown as TrainingInternals;
  }

  it('offers only the learning styles that include the chosen type', () => {
    const page = create();

    page.contentTypeControl.setValue('Article');

    expect(page.learningStyleOptions().map(o => o.value)).toEqual(['', 'reading']);
  });

  it('clears a learning style that no longer fits the chosen type', () => {
    const page = create();
    page.learningStyleControl.setValue('visual');

    page.contentTypeControl.setValue('Article');

    expect(page.learningStyleControl.value).toBe('');
  });

  it('clears every filter from the empty state', () => {
    const page = create();
    page.searchControl.setValue('forklift');
    page.contentTypeControl.setValue('Quiz');
    expect(page.hasActiveFilters()).toBe(true);

    page.clearFilters();

    expect(page.hasActiveFilters()).toBe(false);
  });
});
