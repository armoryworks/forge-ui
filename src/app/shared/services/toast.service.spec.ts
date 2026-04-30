import { TestBed } from '@angular/core/testing';

import { CapabilityDisabledError } from '../errors/capability-disabled.error';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ToastService],
    });

    service = TestBed.inject(ToastService);
  });

  describe('initial state', () => {
    it('should have no toasts initially', () => {
      expect(service.toasts()).toEqual([]);
    });
  });

  describe('show', () => {
    it('should add a toast to the list', () => {
      service.show({ severity: 'info', title: 'Test' });

      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].title).toBe('Test');
      expect(service.toasts()[0].severity).toBe('info');
    });

    it('should prepend new toasts (newest first)', () => {
      service.show({ severity: 'info', title: 'First' });
      service.show({ severity: 'success', title: 'Second' });

      expect(service.toasts()[0].title).toBe('Second');
      expect(service.toasts()[1].title).toBe('First');
    });

    it('should include optional message and details', () => {
      service.show({
        severity: 'error',
        title: 'Error',
        message: 'Something went wrong',
        details: 'Stack trace here',
      });

      const toast = service.toasts()[0];
      expect(toast.message).toBe('Something went wrong');
      expect(toast.details).toBe('Stack trace here');
    });

    it('should assign unique ids to each toast', () => {
      service.show({ severity: 'info', title: 'A' });
      service.show({ severity: 'info', title: 'B' });

      const ids = service.toasts().map(t => t.id);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('should enforce max visible limit of 5', () => {
      for (let i = 0; i < 7; i++) {
        service.show({ severity: 'info', title: `Toast ${i}`, autoDismissMs: 0 });
      }

      // autoDismissMs: 0 means null (no auto-dismiss) for info — but we override
      // The service uses autoDismissMs ?? DEFAULT_DISMISS[severity]
      // For info: default is 8000, so passing 0 explicitly will be 0 (falsy)
      // Actually 0 is falsy so it falls back to 8000. Let's just check the count
      expect(service.toasts().length).toBe(5);
    });
  });

  describe('capability-gate resilience (Phase 4 Phase-D)', () => {
    it('should ignore a toast whose details carry a CapabilityDisabledError', () => {
      const capErr = new CapabilityDisabledError('CAP-EXT-AI-ASSISTANT', 'AI off.');
      service.show({
        severity: 'error',
        title: 'errors.serverError',
        message: 'Forbidden',
        // The interceptor never forwards it — but defend the layer anyway.
        details: capErr as unknown as string,
      });

      expect(service.toasts()).toEqual([]);
    });

    it('should ignore a toast whose details JSON contains the capability-disabled code', () => {
      service.show({
        severity: 'error',
        title: 'errors.serverError',
        message: 'Forbidden',
        details: '{"errors":[{"code":"capability-disabled","capability":"CAP-EXT-CHAT"}]}',
      });

      expect(service.toasts()).toEqual([]);
    });

    it('should still show ordinary error toasts (regression check)', () => {
      service.show({
        severity: 'error',
        title: 'errors.serverError',
        message: 'Database is down',
        details: 'Connection refused',
      });

      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('Database is down');
    });
  });

  describe('dismiss', () => {
    it('should remove a toast by id', () => {
      service.show({ severity: 'info', title: 'Keep' });
      service.show({ severity: 'info', title: 'Remove' });

      const toRemove = service.toasts()[0]; // "Remove" is first (newest)
      service.dismiss(toRemove.id);

      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].title).toBe('Keep');
    });

    it('should handle dismissing non-existent id gracefully', () => {
      service.show({ severity: 'info', title: 'Test' });
      service.dismiss(99999);

      expect(service.toasts().length).toBe(1);
    });

    it('should handle dismissing from empty list', () => {
      service.dismiss(1);
      expect(service.toasts()).toEqual([]);
    });
  });
});
