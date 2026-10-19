import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CommunicationService } from '../../services/communication.service';
import { COMMUNICATIONS_ROUTES } from '../../communications.routes';
import { CommunicationReviewComponent } from './communication-review.component';

describe('CommunicationReviewComponent · bad links', () => {
  function create(id: string, getDetail: () => unknown) {
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
        { provide: Router, useValue: { navigate: vi.fn(), navigateByUrl: vi.fn() } },
        { provide: CommunicationService, useValue: { getDetail: vi.fn(getDetail) } },
        { provide: CustomerService, useValue: { getCustomers: () => of([]) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new CommunicationReviewComponent());
    return {
      view: component as unknown as { loading(): boolean; loadError(): unknown; detail(): unknown },
      service: TestBed.inject(CommunicationService),
    };
  }

  it('shows not-found for a non-numeric id instead of spinning', () => {
    const { view, service } = create('abc', () => of({}));
    expect(view.loading()).toBe(false);
    expect((view.loadError() as HttpErrorResponse).status).toBe(404);
    expect(service.getDetail).not.toHaveBeenCalled();
  });

  it('shows the error and no review form when the message does not exist', () => {
    const missing = new HttpErrorResponse({ status: 404 });
    const { view } = create('1', () => throwError(() => missing));
    expect(view.loadError()).toBe(missing);
    expect(view.detail()).toBeNull();
  });

  it('shows the not-found page for a bare /communications', () => {
    const bare = COMMUNICATIONS_ROUTES.find((r) => r.path === '');
    expect(bare?.data).toEqual({ status: 'notFound' });
  });
});
