import { TestBed } from '@angular/core/testing';
import { HubConnectionState } from '@microsoft/signalr';

import { TimerHubService } from './timer-hub.service';
import { SignalrService } from './signalr.service';

describe('TimerHubService', () => {
  let service: TimerHubService;
  let mockSignalrService: {
    getOrCreateConnection: ReturnType<typeof vi.fn>;
    startConnection: ReturnType<typeof vi.fn>;
    stopConnection: ReturnType<typeof vi.fn>;
  };
  let mockConnection: {
    invoke: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    onreconnected: ReturnType<typeof vi.fn>;
    state: string;
  };

  beforeEach(() => {
    mockConnection = {
      invoke: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      onreconnected: vi.fn(),
      state: HubConnectionState.Connected,
    };

    mockSignalrService = {
      getOrCreateConnection: vi.fn().mockReturnValue(mockConnection),
      startConnection: vi.fn().mockResolvedValue(undefined),
      stopConnection: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        TimerHubService,
        { provide: SignalrService, useValue: mockSignalrService },
      ],
    });

    service = TestBed.inject(TimerHubService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('connect', () => {
    it('should call signalrService.startConnection with timer', async () => {
      await service.connect();
      expect(mockSignalrService.startConnection).toHaveBeenCalledWith('timer');
    });

    it('should get or create connection for timer hub', async () => {
      await service.connect();
      expect(mockSignalrService.getOrCreateConnection).toHaveBeenCalledWith('timer');
    });

    it('should register event handlers', async () => {
      await service.connect();
      expect(mockConnection.on).toHaveBeenCalledWith('timerStarted', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('timerStopped', expect.any(Function));
    });
  });

  describe('disconnect', () => {
    it('should call signalrService.stopConnection with timer', async () => {
      await service.connect();
      await service.disconnect();
      expect(mockSignalrService.stopConnection).toHaveBeenCalledWith('timer');
    });
  });

  describe('joinUserGroup', () => {
    it('should invoke JoinUserGroup on connection', async () => {
      await service.connect();
      await service.joinUserGroup(5);
      expect(mockConnection.invoke).toHaveBeenCalledWith('JoinUserGroup', 5);
    });

    it('should leave current group before joining a new one', async () => {
      await service.connect();
      await service.joinUserGroup(5);
      await service.joinUserGroup(10);
      expect(mockConnection.invoke).toHaveBeenCalledWith('LeaveUserGroup', 5);
      expect(mockConnection.invoke).toHaveBeenCalledWith('JoinUserGroup', 10);
    });

    it('should not invoke if connection is not connected', async () => {
      await service.connect();
      mockConnection.state = HubConnectionState.Disconnected;
      mockConnection.invoke.mockClear();

      await service.joinUserGroup(5);
      expect(mockConnection.invoke).not.toHaveBeenCalled();
    });
  });

  describe('leaveUserGroup', () => {
    it('should invoke LeaveUserGroup on connection', async () => {
      await service.connect();
      await service.joinUserGroup(5);
      mockConnection.invoke.mockClear();

      await service.leaveUserGroup();
      expect(mockConnection.invoke).toHaveBeenCalledWith('LeaveUserGroup', 5);
    });

    it('should not invoke if no group is joined', async () => {
      await service.connect();
      mockConnection.invoke.mockClear();

      await service.leaveUserGroup();
      expect(mockConnection.invoke).not.toHaveBeenCalled();
    });
  });

  describe('event callbacks', () => {
    it('should invoke registered onTimerStarted callback', async () => {
      const callback = vi.fn();
      service.onTimerStartedEvent(callback);
      await service.connect();

      const handler = mockConnection.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'timerStarted',
      )?.[1] as (event: unknown) => void;
      handler?.({ userId: 1, entry: {} });

      expect(callback).toHaveBeenCalledWith({ userId: 1, entry: {} });
    });

    it('should invoke registered onTimerStopped callback', async () => {
      const callback = vi.fn();
      service.onTimerStoppedEvent(callback);
      await service.connect();

      const handler = mockConnection.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'timerStopped',
      )?.[1] as (event: unknown) => void;
      handler?.({ userId: 1, entry: {} });

      expect(callback).toHaveBeenCalledWith({ userId: 1, entry: {} });
    });
  });
});
