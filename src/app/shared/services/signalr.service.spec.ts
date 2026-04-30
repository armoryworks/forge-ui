import { TestBed } from '@angular/core/testing';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';

import { createMockHubConnection } from '../../../testing/signalr.mock';
import { SignalrService } from './signalr.service';
import { AuthService } from './auth.service';

// This spec mocks SignalrService's HubConnection at the SERVICE boundary
// instead of at the module boundary. SignalrService exposes a protected
// `buildHubConnection(hubPath)` factory which we spy on per-test, bypassing
// `vi.mock('@microsoft/signalr')` entirely.
//
// Why? `vi.mock` is patched by Angular's `@angular/build:unit-test` runner
// (`vitest-mock-patch.js`) to forbid relative paths, and the wrapper has a
// known intermittent stack-trace bug that surfaces as
// `TypeError: Cannot read properties of undefined (reading 'trim')` from
// inside Vitest's mock queue. The crash is at suite-init phase (before any
// `it` runs), so Vitest's `retry` config can't recover. Spying on a service
// method avoids the patched-mock code path entirely.
//
// Spec-level imports of @microsoft/signalr (the `HubConnectionState` enum
// and the `createMockHubConnection` helper from src/testing/signalr.mock.ts)
// are aliased via `vitest-base.config.ts` `resolve.alias` so they resolve to
// the manual mock without touching the real module. Production-code imports
// in signalr.service.ts continue to use the real module — they're never
// exercised in tests because we override `buildHubConnection` before any
// connection is built.

describe('SignalrService', () => {
  let service: SignalrService;
  let mockConnection: ReturnType<typeof createMockHubConnection>;
  let mockAuthService: { token: ReturnType<typeof vi.fn>; isAuthenticated: ReturnType<typeof vi.fn>; clearAuth: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockConnection = createMockHubConnection();

    mockAuthService = {
      token: vi.fn().mockReturnValue('test-token'),
      isAuthenticated: vi.fn().mockReturnValue(true),
      clearAuth: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SignalrService,
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    service = TestBed.inject(SignalrService);

    // Override the protected factory so SignalrService never instantiates a
    // real HubConnectionBuilder.
    vi.spyOn(service as unknown as { buildHubConnection: (hubPath: string) => HubConnection }, 'buildHubConnection')
      .mockImplementation(() => mockConnection as unknown as HubConnection);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial disconnected state', () => {
    expect(service.connectionState()).toBe('disconnected');
  });

  it('should have hasEverConnected as false initially', () => {
    expect(service.hasEverConnected()).toBe(false);
  });

  describe('getOrCreateConnection', () => {
    it('should return a HubConnection', () => {
      const connection = service.getOrCreateConnection('board');
      expect(connection).toBeTruthy();
      expect(connection.on).toBeDefined();
      expect(connection.invoke).toBeDefined();
    });

    it('should return the same connection for the same hub path', () => {
      const first = service.getOrCreateConnection('board');
      const second = service.getOrCreateConnection('board');
      expect(first).toBe(second);
    });

    it('should register onreconnecting, onreconnected, and onclose handlers', () => {
      service.getOrCreateConnection('board');
      expect(mockConnection.onreconnecting).toHaveBeenCalled();
      expect(mockConnection.onreconnected).toHaveBeenCalled();
      expect(mockConnection.onclose).toHaveBeenCalled();
    });
  });

  describe('startConnection', () => {
    it('should call start on the connection', async () => {
      mockConnection.start.mockImplementation(() => {
        mockConnection.state = HubConnectionState.Connected;
        return Promise.resolve();
      });

      await service.startConnection('board');
      expect(mockConnection.start).toHaveBeenCalled();
    });

    it('should set connectionState to connected on success', async () => {
      mockConnection.start.mockImplementation(() => {
        mockConnection.state = HubConnectionState.Connected;
        return Promise.resolve();
      });

      await service.startConnection('board');
      expect(service.connectionState()).toBe('connected');
    });

    it('should return the same promise for duplicate start calls', () => {
      mockConnection.start.mockImplementation(() => {
        mockConnection.state = HubConnectionState.Connected;
        return Promise.resolve();
      });

      const p1 = service.startConnection('board');
      const p2 = service.startConnection('board');
      expect(p1).toBe(p2);
    });
  });

  describe('stopConnection', () => {
    it('should call stop on the connection', async () => {
      mockConnection.start.mockImplementation(() => {
        mockConnection.state = HubConnectionState.Connected;
        return Promise.resolve();
      });

      await service.startConnection('board');
      await service.stopConnection('board');
      expect(mockConnection.stop).toHaveBeenCalled();
    });
  });

  describe('stopAll', () => {
    it('should set connectionState to disconnected', async () => {
      await service.stopAll();
      expect(service.connectionState()).toBe('disconnected');
    });
  });
});
