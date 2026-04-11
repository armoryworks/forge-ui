import { TestBed } from '@angular/core/testing';
import { HubConnectionState } from '@microsoft/signalr';

import { BoardHubService } from './board-hub.service';
import { SignalrService } from './signalr.service';

describe('BoardHubService', () => {
  let service: BoardHubService;
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
        BoardHubService,
        { provide: SignalrService, useValue: mockSignalrService },
      ],
    });

    service = TestBed.inject(BoardHubService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('connect', () => {
    it('should call signalrService.startConnection with board', async () => {
      await service.connect();
      expect(mockSignalrService.startConnection).toHaveBeenCalledWith('board');
    });

    it('should get or create connection for board hub', async () => {
      await service.connect();
      expect(mockSignalrService.getOrCreateConnection).toHaveBeenCalledWith('board');
    });

    it('should register event handlers on the connection', async () => {
      await service.connect();
      expect(mockConnection.on).toHaveBeenCalledWith('jobCreated', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('jobMoved', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('jobUpdated', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('jobPositionChanged', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('subtaskChanged', expect.any(Function));
    });
  });

  describe('joinBoard', () => {
    it('should invoke JoinBoard on connection', async () => {
      await service.connect();
      await service.joinBoard(42);
      expect(mockConnection.invoke).toHaveBeenCalledWith('JoinBoard', 42);
    });

    it('should leave current board before joining a new one', async () => {
      await service.connect();
      await service.joinBoard(1);
      await service.joinBoard(2);
      expect(mockConnection.invoke).toHaveBeenCalledWith('LeaveBoard', 1);
      expect(mockConnection.invoke).toHaveBeenCalledWith('JoinBoard', 2);
    });

    it('should not invoke if connection is not connected', async () => {
      await service.connect();
      mockConnection.state = HubConnectionState.Disconnected;
      mockConnection.invoke.mockClear();

      await service.joinBoard(42);
      expect(mockConnection.invoke).not.toHaveBeenCalled();
    });
  });

  describe('leaveBoard', () => {
    it('should invoke LeaveBoard on connection', async () => {
      await service.connect();
      await service.joinBoard(42);
      mockConnection.invoke.mockClear();

      await service.leaveBoard();
      expect(mockConnection.invoke).toHaveBeenCalledWith('LeaveBoard', 42);
    });

    it('should not invoke if no board is joined', async () => {
      await service.connect();
      mockConnection.invoke.mockClear();

      await service.leaveBoard();
      expect(mockConnection.invoke).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should call signalrService.stopConnection with board', async () => {
      await service.connect();
      await service.disconnect();
      expect(mockSignalrService.stopConnection).toHaveBeenCalledWith('board');
    });
  });

  describe('event callbacks', () => {
    it('should invoke registered onJobCreated callback', async () => {
      const callback = vi.fn();
      service.onJobCreatedEvent(callback);
      await service.connect();

      // Find the handler registered for 'jobCreated' and call it
      const handler = mockConnection.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'jobCreated',
      )?.[1] as (event: unknown) => void;
      handler?.({ id: 1 });

      expect(callback).toHaveBeenCalledWith({ id: 1 });
    });

    it('should invoke registered onJobMoved callback', async () => {
      const callback = vi.fn();
      service.onJobMovedEvent(callback);
      await service.connect();

      const handler = mockConnection.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'jobMoved',
      )?.[1] as (event: unknown) => void;
      handler?.({ jobId: 1, stageId: 2 });

      expect(callback).toHaveBeenCalledWith({ jobId: 1, stageId: 2 });
    });
  });
});
