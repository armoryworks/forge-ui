import { Injectable, signal, computed, NgZone, inject, OnDestroy } from '@angular/core';

export interface RfidScanEvent {
  uid: string;
  timestamp: Date;
  raw: Uint8Array;
}

type TransportMode = 'none' | 'websocket' | 'webhid';

const RELAY_URL = 'ws://localhost:9876';
const WS_RECONNECT_DELAY = 3000;
const RELAY_NOT_INSTALLED_MSG = 'rfid.relayNotInstalled';

@Injectable({ providedIn: 'root' })
export class WebHidRfidService implements OnDestroy {
  private readonly zone = inject(NgZone);

  // Transport state
  private mode: TransportMode = 'none';

  // WebSocket transport
  private ws: WebSocket | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wsIntentionalClose = false;

  // WebHID transport
  private device: HIDDevice | null = null;
  private inputHandler: ((event: HIDInputReportEvent) => void) | null = null;
  private disconnectHandler: ((event: HIDConnectionEvent) => void) | null = null;

  // Track all connected reader names (relay may report multiple interfaces)
  private connectedDevices = new Set<string>();

  private readonly _connected = signal(false);
  private readonly _deviceName = signal<string | null>(null);
  private readonly _lastScan = signal<RfidScanEvent | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _mode = signal<TransportMode>('none');

  readonly connected = this._connected.asReadonly();
  readonly deviceName = this._deviceName.asReadonly();
  readonly lastScan = this._lastScan.asReadonly();
  readonly error = this._error.asReadonly();
  readonly activeMode = this._mode.asReadonly();
  readonly webHidSupported = computed(() => 'hid' in navigator);

  // Always "supported" — WebSocket relay works in any browser
  readonly supported = computed(() => true);

  // ── Public API ──

  /**
   * Connect to the RFID relay WebSocket server (works in any browser).
   * Falls back to WebHID if the relay isn't running and WebHID is available.
   */
  async connect(): Promise<boolean> {
    if (this._connected()) return true;

    // Try WebSocket relay first (cross-browser)
    const wsSuccess = await this.connectWebSocket();
    if (wsSuccess) return true;

    // Fall back to WebHID (Chromium only)
    if (this.webHidSupported()) {
      return this.reconnectWebHid();
    }

    this._error.set(RELAY_NOT_INSTALLED_MSG);
    return false;
  }

  /**
   * Prompt to pair a WebHID device (Chromium only) or connect to relay.
   */
  async requestDevice(): Promise<boolean> {
    // Try WebSocket relay first
    const wsSuccess = await this.connectWebSocket();
    if (wsSuccess) return true;

    // Fall back to WebHID picker
    if (this.webHidSupported()) {
      return this.requestWebHidDevice();
    }

    this._error.set(RELAY_NOT_INSTALLED_MSG);
    return false;
  }

  async disconnect(): Promise<void> {
    this.wsIntentionalClose = true;
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.device) {
      try { await this.device.close(); } catch { /* ignore */ }
      this.cleanupWebHid();
    }
    this.mode = 'none';
    this._mode.set('none');
    this._connected.set(false);
    this._deviceName.set(null);
  }

  /**
   * Try to auto-connect (called on page load).
   * Silently tries WebSocket relay, then WebHID reconnect.
   */
  async reconnect(): Promise<boolean> {
    // Try WebSocket relay first (silent, no error if not running)
    const wsSuccess = await this.connectWebSocket();
    if (wsSuccess) return true;

    // Try WebHID reconnect (Chromium only, previously paired devices)
    if (this.webHidSupported()) {
      return this.reconnectWebHid();
    }

    return false;
  }

  /**
   * Silently checks whether the relay WebSocket is reachable.
   * Sets the error signal to RELAY_NOT_INSTALLED_MSG if it isn't,
   * so the UI can show the download prompt without the user clicking anything.
   * No-op if already connected.
   */
  async probeRelay(): Promise<void> {
    if (this._connected()) return;
    const reachable = await this.connectWebSocket();
    if (!reachable) {
      this._error.set(RELAY_NOT_INSTALLED_MSG);
    }
  }

  clearLastScan(): void {
    this._lastScan.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  // Prefer contactless/NFC reader names over contact/EMV readers
  private pickBestDeviceName(): string | null {
    if (this.connectedDevices.size === 0) return null;
    const contactlessKeywords = /contactless|nfc|rfid|acr122/i;
    for (const name of this.connectedDevices) {
      if (contactlessKeywords.test(name)) return name;
    }
    return this.connectedDevices.values().next().value ?? null;
  }

  // ── WebSocket Transport ──

  private connectWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve(true);
        return;
      }

      try {
        const ws = new WebSocket(RELAY_URL);
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 2000);

        ws.onopen = () => {
          clearTimeout(timeout);
          this.ws = ws;
          this.mode = 'websocket';
          this.wsIntentionalClose = false;
          this.zone.run(() => {
            this._mode.set('websocket');
            this._connected.set(true);
            this._error.set(null);
          });
          this.setupWebSocketHandlers(ws);
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  }

  private setupWebSocketHandlers(ws: WebSocket): void {
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'scan':
            this.zone.run(() => {
              this._lastScan.set({
                uid: msg.uid,
                timestamp: new Date(msg.timestamp),
                raw: new Uint8Array(msg.raw || []),
              });
            });
            break;
          case 'connected':
            this.connectedDevices.add(msg.device);
            this.zone.run(() => {
              this._deviceName.set(this.pickBestDeviceName());
              this._connected.set(true);
            });
            break;
          case 'disconnected':
            this.connectedDevices.delete(msg.device);
            this.zone.run(() => {
              if (this.connectedDevices.size === 0) {
                this._deviceName.set(null);
                this._error.set('RFID reader disconnected from relay');
              } else {
                this._deviceName.set(this.pickBestDeviceName());
              }
            });
            break;
          case 'error':
            this.zone.run(() => {
              this._error.set(msg.message);
            });
            break;
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => {
      if (this.mode === 'websocket') {
        this.connectedDevices.clear();
        this.zone.run(() => {
          this._connected.set(false);
          this._deviceName.set(null);
        });
        this.ws = null;
        this.mode = 'none';
        this._mode.set('none');

        // Auto-reconnect unless intentionally closed
        if (!this.wsIntentionalClose) {
          this.wsReconnectTimer = setTimeout(() => {
            this.connectWebSocket();
          }, WS_RECONNECT_DELAY);
        }
      }
    };
  }

  // ── WebHID Transport ──

  private async requestWebHidDevice(): Promise<boolean> {
    try {
      const devices = await navigator.hid.requestDevice({ filters: [] });
      if (devices.length === 0) return false;
      await this.openWebHidDevice(devices[0]);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request device';
      this._error.set(msg);
      return false;
    }
  }

  private async reconnectWebHid(): Promise<boolean> {
    try {
      const devices = await navigator.hid.getDevices();
      if (devices.length === 0) return false;
      await this.openWebHidDevice(devices[0]);
      return true;
    } catch {
      return false;
    }
  }

  private async openWebHidDevice(device: HIDDevice): Promise<void> {
    if (this.device) {
      try { await this.device.close(); } catch { /* ignore */ }
      this.cleanupWebHid();
    }

    this.device = device;
    this.mode = 'webhid';
    this._mode.set('webhid');
    this._deviceName.set(device.productName || `HID Device (${device.vendorId.toString(16)}:${device.productId.toString(16)})`);
    this._error.set(null);

    if (!device.opened) {
      await device.open();
    }

    this.inputHandler = (event: HIDInputReportEvent) => {
      const data = new Uint8Array(event.data.buffer);
      const uid = this.extractUid(data);
      if (!uid) return;

      this.zone.run(() => {
        this._lastScan.set({ uid, timestamp: new Date(), raw: data });
      });
    };
    device.addEventListener('inputreport', this.inputHandler);

    this.disconnectHandler = (event: HIDConnectionEvent) => {
      if (event.device === this.device) {
        this.zone.run(() => {
          this._connected.set(false);
          this._deviceName.set(null);
          this._error.set('RFID reader disconnected');
        });
        this.cleanupWebHid();
      }
    };
    navigator.hid.addEventListener('disconnect', this.disconnectHandler);

    this._connected.set(true);
  }

  private extractUid(data: Uint8Array): string | null {
    let start = 0;
    let end = data.length - 1;

    while (start < data.length && data[start] === 0) start++;
    while (end > start && data[end] === 0) end--;

    if (start > end) return null;

    const payload = data.slice(start, end + 1);
    if (payload.length === 0) return null;

    let uidBytes = payload;
    if (payload.length > 1 && payload[0] === payload.length - 1) {
      uidBytes = payload.slice(1);
    }

    if (uidBytes.length === 0) return null;

    const hex = Array.from(uidBytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join('');

    if (hex.length < 2 || hex.length > 40) return null;

    return hex;
  }

  private cleanupWebHid(): void {
    if (this.device && this.inputHandler) {
      this.device.removeEventListener('inputreport', this.inputHandler);
    }
    if (this.disconnectHandler && 'hid' in navigator) {
      navigator.hid.removeEventListener('disconnect', this.disconnectHandler);
    }
    this.device = null;
    this.inputHandler = null;
    this.disconnectHandler = null;
    if (this.mode === 'webhid') {
      this.mode = 'none';
      this._mode.set('none');
      this._connected.set(false);
      this._deviceName.set(null);
    }
  }
}
