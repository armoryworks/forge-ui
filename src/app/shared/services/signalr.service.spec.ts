import { TestBed } from '@angular/core/testing';
import { HubConnectionState } from '@microsoft/signalr';

import { SignalrService } from './signalr.service';
import { AuthService } from './auth.service';

// Use vi.hoisted() so the holder is created at the same hoist phase as
// vi.mock(), guaranteeing the factory closure binds to a real object before
// any module (this spec OR a co-loaded sibling spec like board-hub) imports
// '@microsoft/signalr'. Without this, parallel-worker module-cache contention
// can let the real SignalR module load first, causing the mock to never apply
// and tests to time out trying to negotiate a real HTTP connection.
const mocks = vi.hoisted(() => {
  const createMockConnection = () => ({
    state: 'Disconnected' as string,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
  });

  // Holder pattern: the factory's HubConnectionBuilder.build() reads
  // holder.connection lazily, so beforeEach can swap in a fresh mock per test
  // without re-registering the mock module.
  const holder: { connection: ReturnType<typeof createMockConnection> } = {
    connection: createMockConnection(),
  };

  return { createMockConnection, holder };
});

vi.mock('@microsoft/signalr', () => {
  const HubConnectionState = {
    Disconnected: 'Disconnected',
    Connecting: 'Connecting',
    Connected: 'Connected',
    Disconnecting: 'Disconnecting',
    Reconnecting: 'Reconnecting',
  };

  const LogLevel = {
    Warning: 4,
    Information: 2,
  };

  class HubConnectionBuilder {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() { return mocks.holder.connection; }
  }

  return {
    HubConnectionState,
    LogLevel,
    HubConnectionBuilder,
  };
});

describe('SignalrService', () => {
  let service: SignalrService;
  let mockConnection: ReturnType<typeof mocks.createMockConnection>;
  let mockAuthService: { token: ReturnType<typeof vi.fn>; isAuthenticated: ReturnType<typeof vi.fn>; clearAuth: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockConnection = mocks.createMockConnection();
    mocks.holder.connection = mockConnection;

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
