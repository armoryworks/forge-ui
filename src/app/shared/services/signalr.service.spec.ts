import { TestBed } from '@angular/core/testing';
import { HubConnectionState } from '@microsoft/signalr';

import { SignalrService } from './signalr.service';
import { AuthService } from './auth.service';

// Create a factory so each test gets a fresh mock connection
function createMockConnection() {
  return {
    state: HubConnectionState.Disconnected as string,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
  };
}

let mockConnection = createMockConnection();

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
    build() { return mockConnection; }
  }

  return {
    HubConnectionState,
    LogLevel,
    HubConnectionBuilder,
  };
});

describe('SignalrService', () => {
  let service: SignalrService;
  let mockAuthService: { token: ReturnType<typeof vi.fn>; isAuthenticated: ReturnType<typeof vi.fn>; clearAuth: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockConnection = createMockConnection();

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
