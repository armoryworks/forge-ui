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

  describe('scan timing', () => {
    let clock = 0;

    function key(key: string, at: number): void {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'timeStamp', { value: at });
      document.body.dispatchEvent(event);
    }

    beforeEach(() => {
      vi.useFakeTimers();
      clock = 1_000;
      service.start();
    });

    afterEach(() => vi.useRealTimers());

    it('keeps a scan whole when the page stalls partway through it', () => {
      key('J', clock);
      key('-', clock + 8);
      key('2', clock + 16);
      vi.setSystemTime(Date.now() + 400);
      key('4', clock + 24);
      key('0', clock + 32);
      key('3', clock + 40);
      key('Enter', clock + 48);

      expect(service.lastScan()?.value).toBe('J-2403');
    });

    it('waits out a stalled fallback timer instead of sending half a scan', () => {
      const realNow = performance.now.bind(performance);
      let skew = 0;
      const now = vi.spyOn(performance, 'now').mockImplementation(() => realNow() + skew);

      key('J', clock);
      key('-', clock + 8);
      key('2', clock + 16);
      key('4', clock + 24);
      skew = 500;
      vi.advanceTimersByTime(80);
      expect(service.lastScan()).toBeNull();

      key('0', clock + 32);
      key('3', clock + 40);
      vi.advanceTimersByTime(80);

      expect(service.lastScan()?.value).toBe('J-2403');
      now.mockRestore();
    });

    it('does not treat slow typing on the board as a scan', () => {
      [...'J-2403'].forEach((k, i) => key(k, clock + i * 120));
      key('Enter', clock + 6 * 120);
      vi.advanceTimersByTime(200);

      expect(service.lastScan()).toBeNull();
    });

    it('does not let the fallback timer send slow typing as a scan', () => {
      [...'J-2403'].forEach((k, i) => {
        key(k, clock + i * 60);
        vi.advanceTimersByTime(60);
      });
      vi.advanceTimersByTime(200);

      expect(service.lastScan()).toBeNull();
    });

    it('keeps a scan whole across one 60 ms gap inside the burst', () => {
      key('J', clock);
      key('-', clock + 8);
      key('2', clock + 16);
      vi.advanceTimersByTime(60);
      key('4', clock + 76);
      key('0', clock + 84);
      key('3', clock + 92);
      key('Enter', clock + 100);

      expect(service.lastScan()?.value).toBe('J-2403');
    });

    it('starts over after a 120 ms gap', () => {
      key('X', clock);
      key('Y', clock + 8);
      key('Z', clock + 16);
      vi.advanceTimersByTime(120);
      [...'J-2403'].forEach((k, i) => key(k, clock + 136 + i * 8));
      key('Enter', clock + 136 + 6 * 8);

      expect(service.lastScan()?.value).toBe('J-2403');
    });

    it('sends a fast burst with no Enter through the fallback timer', () => {
      [...'J-2403'].forEach((k, i) => key(k, clock + i * 8));
      vi.advanceTimersByTime(80);

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
  describe('typed entry', () => {
    it('publishes a typed code as a scan in the current context', () => {
      service.setContext('inventory');

      service.submit('  RM-100 ');

      expect(service.lastScan()).toMatchObject({ value: 'RM-100', context: 'inventory' });
    });

    it('ignores blank entries and entries while scanning is disabled', () => {
      service.submit('   ');
      expect(service.lastScan()).toBeNull();

      service.disable();
      service.submit('RM-100');
      expect(service.lastScan()).toBeNull();
    });
  });
});
