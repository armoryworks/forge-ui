// Required for Angular JIT compilation of component templates in unit tests
import '@angular/compiler';

// jsdom does not implement window.matchMedia — provide a stub
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

// `destroyAfterEach: false` works around a known Angular 21 + Vitest
// teardown race: HTTP interceptors dispatch work in a microtask that
// completes after TestBed destroys its injector, surfacing as
// `NG0205: Injector has already been destroyed`. Per-spec
// `beforeEach(TestBed.configureTestingModule(...))` still gives each
// `it` a fresh provider configuration; only the bare TestBed root
// outlives.
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
  { teardown: { destroyAfterEach: false } },
);

// ─────────────────────────────────────────────────────────────────────
// Global @microsoft/signalr mock.
//
// Vitest's per-worker module isolation means each Vitest worker has its own
// module cache. A `vi.mock('@microsoft/signalr')` in one spec file applies
// only within that worker. If parallel workers run other specs that
// transitively import services using SignalR (e.g., NotificationHubService,
// BoardHubService, TimerHubService — used widely across feature modules),
// those workers load the REAL SignalR module and any stray .start() call
// tries to negotiate a real HTTP connection — fetch fails, test times out.
//
// History: a self-contained vi.hoisted mock in signalr.service.spec.ts
// (commit eb2e819) fixed intra-worker load ordering. Phase 4/5 added more
// specs that pull in workflow infra, expanding the surface where co-loaded
// SignalR code can trigger this in non-mocking workers. Promoting the mock
// to global test setup eliminates the worker-pool dependency entirely:
// every worker installs the mock at startup, before any spec loads.
//
// The mock matches the shape the existing spec used. Specs that need
// per-test customization can still vi.spyOn the connection's methods or
// override the mock locally with vi.mocked(...).
// ─────────────────────────────────────────────────────────────────────
import { vi } from 'vitest';

vi.mock('@microsoft/signalr', () => {
  const HubConnectionState = {
    Disconnected: 'Disconnected',
    Connecting: 'Connecting',
    Connected: 'Connected',
    Disconnecting: 'Disconnecting',
    Reconnecting: 'Reconnecting',
  };

  const LogLevel = {
    Trace: 0,
    Debug: 1,
    Information: 2,
    Warning: 3,
    Error: 4,
    Critical: 5,
    None: 6,
  };

  const createMockConnection = () => ({
    state: HubConnectionState.Disconnected as string,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    invoke: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
  });

  class HubConnectionBuilder {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() {
      return createMockConnection();
    }
  }

  return { HubConnectionState, LogLevel, HubConnectionBuilder };
});
