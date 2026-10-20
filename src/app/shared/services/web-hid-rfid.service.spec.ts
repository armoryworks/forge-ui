import { TestBed } from '@angular/core/testing';

import { WebHidRfidService } from './web-hid-rfid.service';

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.readyState = 3;
  }
}

describe('WebHidRfidService relay auto-probe', () => {
  let service: WebHidRfidService;
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    localStorage.removeItem('rfid:relay-seen');
    FakeWebSocket.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
    TestBed.configureTestingModule({ providers: [WebHidRfidService] });
    service = TestBed.inject(WebHidRfidService);
  });

  afterEach(() => {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = originalWebSocket;
    localStorage.removeItem('rfid:relay-seen');
  });

  it('opens no WebSocket on reconnect when the relay has never connected on this device', async () => {
    await service.reconnect();
    expect(FakeWebSocket.instances.length).toBe(0);
  });

  it('probes the relay when asked to, and remembers it once it connects', async () => {
    const pending = service.reconnect({ probeRelay: true });
    expect(FakeWebSocket.instances.length).toBe(1);
    FakeWebSocket.instances[0].readyState = FakeWebSocket.OPEN;
    FakeWebSocket.instances[0].onopen?.();
    expect(await pending).toBe(true);
    expect(localStorage.getItem('rfid:relay-seen')).toBe('1');
  });

  it('tries the relay on reconnect once it has connected before', async () => {
    localStorage.setItem('rfid:relay-seen', '1');
    const pending = service.reconnect();
    expect(FakeWebSocket.instances.length).toBe(1);
    FakeWebSocket.instances[0].onerror?.();
    await pending;
  });

  it('still probes from probeRelay without the flag', async () => {
    const pending = service.probeRelay();
    expect(FakeWebSocket.instances.length).toBe(1);
    FakeWebSocket.instances[0].onerror?.();
    await pending;
    expect(service.error()).toBe('rfid.relayNotInstalled');
  });
});
