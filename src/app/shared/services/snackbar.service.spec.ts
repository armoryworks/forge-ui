import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { markHttpErrorShown } from '../utils/shown-http-errors';
import { SnackbarService } from './snackbar.service';

describe('SnackbarService', () => {
  let service: SnackbarService;
  let snackBarSpy: {
    open: ReturnType<typeof vi.fn>;
    dismiss: ReturnType<typeof vi.fn>;
  };
  let routerSpy: {
    navigate: ReturnType<typeof vi.fn>;
    events: Subject<unknown>;
  };
  let actionSubject: Subject<void>;

  beforeEach(() => {
    actionSubject = new Subject<void>();

    snackBarSpy = {
      open: vi.fn().mockReturnValue({
        onAction: () => actionSubject.asObservable(),
      } as Partial<MatSnackBarRef<TextOnlySnackBar>>),
      dismiss: vi.fn(),
    };

    routerSpy = {
      navigate: vi.fn(),
      events: new Subject<unknown>(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: MatSnackBar, useValue: snackBarSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => (key === 'common.dismiss' ? 'Dismiss' : key) },
        },
      ],
    });

    service = TestBed.inject(SnackbarService);
  });

  describe('success', () => {
    it('should open snackbar with success panel class and 4s duration', () => {
      service.success('Job saved');

      expect(snackBarSpy.open).toHaveBeenCalledWith('Job saved', 'Dismiss', {
        duration: 4000,
        panelClass: ['snackbar--success'],
      });
    });
  });

  describe('info', () => {
    it('should open snackbar with info panel class and 4s duration', () => {
      service.info('Sync complete');

      expect(snackBarSpy.open).toHaveBeenCalledWith('Sync complete', 'Dismiss', {
        duration: 4000,
        panelClass: ['snackbar--info'],
      });
    });
  });

  describe('warn', () => {
    it('should open snackbar with warn panel class and 8s duration', () => {
      service.warn('Low stock detected');

      expect(snackBarSpy.open).toHaveBeenCalledWith('Low stock detected', 'Dismiss', {
        duration: 8000,
        panelClass: ['snackbar--warn'],
      });
    });
  });

  describe('error', () => {
    it('should open snackbar with error panel class and 10s duration', () => {
      service.error('Failed to save');

      expect(snackBarSpy.open).toHaveBeenCalledWith('Failed to save', 'Dismiss', {
        duration: 10000,
        panelClass: ['snackbar--error'],
      });
    });
  });

  describe('successWithNav', () => {
    it('should open snackbar with custom action label', () => {
      service.successWithNav('Job created', '/jobs/42', 'View Job');

      expect(snackBarSpy.open).toHaveBeenCalledWith('Job created', 'View Job', {
        duration: 4000,
        panelClass: ['snackbar--success'],
      });
    });

    it('should navigate to route when action is clicked', () => {
      service.successWithNav('Job created', '/jobs/42', 'View Job');

      actionSubject.next();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/jobs/42']);
    });

    it('should not navigate if action is not clicked', () => {
      service.successWithNav('Job created', '/jobs/42', 'View Job');

      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  describe('errorFrom', () => {
    const errorPanel = { duration: 10000, panelClass: ['snackbar--error'] };

    it('shows the problem detail', () => {
      const err = new HttpErrorResponse({
        status: 409,
        error: { title: 'Action not allowed', detail: 'Cannot delete order with active shipments' },
      });

      service.errorFrom(err, 'orders.deleteFailed');

      expect(snackBarSpy.open).toHaveBeenCalledWith('Cannot delete order with active shipments', 'Dismiss', errorPanel);
    });

    it('falls back to the problem title when there is no detail', () => {
      const err = new HttpErrorResponse({ status: 400, error: { title: 'Validation failed' } });

      service.errorFrom(err, 'orders.saveFailed');

      expect(snackBarSpy.open).toHaveBeenCalledWith('Validation failed', 'Dismiss', errorPanel);
    });

    it('falls back to the translated key when the body carries no text', () => {
      service.errorFrom(new HttpErrorResponse({ status: 404, error: null }), 'orders.saveFailed');
      service.errorFrom(new Error('boom'), 'orders.saveFailed');

      expect(snackBarSpy.open).toHaveBeenNthCalledWith(1, 'orders.saveFailed', 'Dismiss', errorPanel);
      expect(snackBarSpy.open).toHaveBeenNthCalledWith(2, 'orders.saveFailed', 'Dismiss', errorPanel);
    });

    it('does nothing when the interceptor already showed the error', () => {
      const err = new HttpErrorResponse({ status: 400, error: { detail: 'Quantity must be greater than zero.' } });
      markHttpErrorShown(err);

      service.errorFrom(err, 'orders.saveFailed');

      expect(snackBarSpy.open).not.toHaveBeenCalled();
    });
  });
});
