import { TestBed } from '@angular/core/testing';

import { ScannerService } from './scanner.service';

describe('ScannerService', () => {
  let service: ScannerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScannerService],
    });

    service = TestBed.inject(ScannerService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  describe('initial state', () => {
    it('should not be listening initially', () => {
      expect(service.listening()).toBe(false);
    });

    it('should be enabled initially', () => {
      expect(service.enabled()).toBe(true);
    });

    it('should have global context initially', () => {
      expect(service.context()).toBe('global');
    });

    it('should have no last scan initially', () => {
      expect(service.lastScan()).toBeNull();
    });

    it('should not have a recent scan initially', () => {
      expect(service.hasRecentScan()).toBe(false);
    });
  });

  describe('start and stop', () => {
    it('should set listening to true when started', () => {
      service.start();
      expect(service.listening()).toBe(true);
    });

    it('should set listening to false when stopped', () => {
      service.start();
      service.stop();
      expect(service.listening()).toBe(false);
    });

    it('should not start twice if already listening', () => {
      service.start();
      service.start(); // should be a no-op
      expect(service.listening()).toBe(true);
    });

    it('should not stop if not listening', () => {
      service.stop(); // should be a no-op, no error
      expect(service.listening()).toBe(false);
    });
  });

  describe('setContext', () => {
    it('should update the context signal', () => {
      service.setContext('inventory');
      expect(service.context()).toBe('inventory');
    });

    it('should allow changing context multiple times', () => {
      service.setContext('parts');
      service.setContext('shipping');
      expect(service.context()).toBe('shipping');
    });
  });

  describe('enable and disable', () => {
    it('should set enabled to false when disabled', () => {
      service.disable();
      expect(service.enabled()).toBe(false);
    });

    it('should set enabled to true when re-enabled', () => {
      service.disable();
      service.enable();
      expect(service.enabled()).toBe(true);
    });
  });

  describe('clearLastScan', () => {
    it('should clear the last scan signal', () => {
      // Directly test that clearLastScan sets lastScan to null
      service.clearLastScan();
      expect(service.lastScan()).toBeNull();
    });
  });

  describe('ngOnDestroy', () => {
    it('should stop listening on destroy', () => {
      service.start();
      expect(service.listening()).toBe(true);

      service.ngOnDestroy();
      expect(service.listening()).toBe(false);
    });
  });
});
