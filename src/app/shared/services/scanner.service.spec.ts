import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { ScannerService } from './scanner.service';
import { WebHidRfidService } from './web-hid-rfid.service';

describe('ScannerService', () => {
  let service: ScannerService;

  beforeEach(() => {
    const mockRfid = {
      lastScan: signal(null),
      clearLastScan: vi.fn(),
      reconnect: vi.fn().mockResolvedValue(false),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        ScannerService,
        { provide: WebHidRfidService, useValue: mockRfid },
      ],
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

  describe('keystrokes in editable fields', () => {
    let host: HTMLElement;

    function typeFast(target: HTMLElement, text: string): void {
      for (const key of [...text, 'Enter']) {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        vi.advanceTimersByTime(10);
      }
    }

    beforeEach(() => {
      vi.useFakeTimers();
      host = document.createElement('div');
      document.body.appendChild(host);
      service.start();
    });

    afterEach(() => {
      host.remove();
      vi.useRealTimers();
    });

    it('does not treat fast typing in a text box as a scan', () => {
      const input = document.createElement('input');
      input.type = 'text';
      host.appendChild(input);

      typeFast(input, 'J-2403');
      vi.advanceTimersByTime(200);

      expect(service.lastScan()).toBeNull();
    });

    it('does not carry a burst that began outside a text box into it', () => {
      const input = document.createElement('input');
      input.type = 'search';
      host.appendChild(input);

      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', bubbles: true }));
      vi.advanceTimersByTime(10);
      typeFast(input, '-2403');
      vi.advanceTimersByTime(200);

      expect(service.lastScan()).toBeNull();
    });

    it('still reads a scan typed into a barcode scan input', () => {
      const scanHost = document.createElement('app-barcode-scan-input');
      const input = document.createElement('input');
      input.type = 'text';
      scanHost.appendChild(input);
      host.appendChild(scanHost);

      typeFast(input, 'J-2403');

      expect(service.lastScan()?.value).toBe('J-2403');
    });

    it('reads a scan when no field has focus', () => {
      typeFast(document.body, 'J-2403');

      expect(service.lastScan()?.value).toBe('J-2403');
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
