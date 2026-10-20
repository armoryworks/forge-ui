import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, throwError } from 'rxjs';

import { TrainingService } from '../services/training.service';
import { TrainingModuleComponent } from './training-module.component';

describe('TrainingModuleComponent loading', () => {
  function open(id: string, response: Observable<never>): { page: { loadError(): unknown; isLoading(): boolean; load(): void }; get: ReturnType<typeof vi.spyOn> } {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }), queryParamMap: convertToParamMap({}) } },
        },
      ],
    });
    const get = vi.spyOn(TestBed.inject(TrainingService), 'getModule').mockReturnValue(response);
    const page = TestBed.runInInjectionContext(() => new TrainingModuleComponent()) as unknown as {
      loadError(): unknown; isLoading(): boolean; load(): void;
    };
    page.load();
    return { page, get };
  }

  it.each(['abc', '12abc', '1.5', '0'])('shows not-found without asking the server for the malformed id %s', (id) => {
    const { page, get } = open(id, throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(get).not.toHaveBeenCalled();
    expect((page.loadError() as HttpErrorResponse).status).toBe(404);
    expect(page.isLoading()).toBe(false);
  });

  it('keeps the server error so a failed load offers a retry instead of a blank page', () => {
    const { page, get } = open('7', throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(get).toHaveBeenCalledWith(7);
    expect((page.loadError() as HttpErrorResponse).status).toBe(500);
    expect(page.isLoading()).toBe(false);
  });
});
