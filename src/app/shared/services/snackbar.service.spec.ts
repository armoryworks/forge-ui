import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import { SnackbarService } from './snackbar.service';

describe('SnackbarService', () => {
  let service: SnackbarService;
  let snackBarSpy: {
    open: ReturnType<typeof vi.fn>;
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
});
