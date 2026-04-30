/**
 * Manual mock for `@microsoft/signalr` used by spec-level imports.
 *
 * SCOPE: The `resolve.alias` in `vitest-base.config.ts` redirects this
 * module for SPEC-LEVEL imports only — `import { HubConnectionState }
 * from '@microsoft/signalr'` in a `.spec.ts` file resolves here. The
 * Angular `@angular/build:unit-test` runner pre-bundles production code
 * (`signalr.service.ts` → `@microsoft/signalr`) via its own Vite
 * instance that does NOT honor the test-time alias, so production-code
 * imports still see the real module unless a spec uses `vi.mock(...)`.
 *
 * WHY A MANUAL MOCK: Several specs import `HubConnectionState` as a
 * value (e.g., `timer-hub.service.spec.ts`, `board-hub.service.spec.ts`)
 * without mocking the module. Without the alias, those imports load
 * the real `@microsoft/signalr`, and any stray `.start()` call from
 * code under test would attempt a real HTTP negotiation that fails in
 * jsdom with "fetch failed" — the original CI flake mode (eb2e819 /
 * 921d0c0). The alias eliminates that failure path for spec imports
 * without relying on `vi.mock`, which has its own intermittent failure
 * mode under Angular's `vitest-mock-patch.js` wrapper (see
 * vitest-base.config.ts `retry` config).
 *
 * SPECS THAT MUST MOCK PRODUCTION-CODE IMPORTS: Use `vi.mock(...)` in
 * the spec file (the only mechanism that intercepts production-code
 * imports of an external module under Angular's pre-built application
 * bundle). See `signalr.service.spec.ts` for an example. Such specs
 * benefit from `retry: 2` in the Vitest config to absorb intermittent
 * `vitest-mock-patch.js` "trim" crashes.
 */

import { vi } from 'vitest';

export const HubConnectionState = {
  Disconnected: 'Disconnected',
  Connecting: 'Connecting',
  Connected: 'Connected',
  Disconnecting: 'Disconnecting',
  Reconnecting: 'Reconnecting',
} as const;

export const LogLevel = {
  Trace: 0,
  Debug: 1,
  Information: 2,
  Warning: 3,
  Error: 4,
  Critical: 5,
  None: 6,
} as const;

export const createMockHubConnection = () => ({
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
  baseUrl: '',
  connectionId: 'mock-connection-id',
  serverTimeoutInMilliseconds: 30000,
  keepAliveIntervalInMilliseconds: 15000,
});

export class HubConnectionBuilder {
  withUrl(): this { return this; }
  withAutomaticReconnect(): this { return this; }
  configureLogging(): this { return this; }
  withHubProtocol(): this { return this; }
  withServerTimeout(): this { return this; }
  withKeepAliveInterval(): this { return this; }
  withStatefulReconnect(): this { return this; }
  build() {
    return createMockHubConnection();
  }
}

// Additional named exports the real module provides — kept as no-op stubs
// so import statements like `import { HttpTransportType } from '@microsoft/signalr'`
// resolve without runtime errors. Add more shims here if a future spec needs them.
export const HttpTransportType = {
  None: 0,
  WebSockets: 1,
  ServerSentEvents: 2,
  LongPolling: 4,
} as const;

export const TransferFormat = {
  Text: 1,
  Binary: 2,
} as const;

export class JsonHubProtocol {
  readonly name = 'json';
  readonly version = 1;
  readonly transferFormat = TransferFormat.Text;
  parseMessages(): unknown[] { return []; }
  writeMessage(): string { return ''; }
}

// Default export shim (some bundlers / CJS interop expects this)
export default {
  HubConnectionState,
  LogLevel,
  HubConnectionBuilder,
  HttpTransportType,
  TransferFormat,
  JsonHubProtocol,
};
