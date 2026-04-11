import { TestBed } from '@angular/core/testing';

import { DraftBroadcastService } from './draft-broadcast.service';
import { Draft } from '../models/draft.model';

describe('DraftBroadcastService', () => {
  let service: DraftBroadcastService;
  let mockChannel: { postMessage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; onmessage: ((event: MessageEvent) => void) | null };

  beforeEach(() => {
    mockChannel = {
      postMessage: vi.fn(),
      close: vi.fn(),
      onmessage: null,
    };

    // Mock BroadcastChannel as a constructor class
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        Object.assign(this, mockChannel);
        return mockChannel as unknown as BroadcastChannel;
      }
    });

    TestBed.configureTestingModule({
      providers: [DraftBroadcastService],
    });

    service = TestBed.inject(DraftBroadcastService);
    service.initialize();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── broadcastDraftUpdated ──

  it('broadcastDraftUpdated should post message to channel', () => {
    const draft: Draft = {
      key: '1:job:new',
      userId: 1,
      entityType: 'job',
      entityId: 'new',
      displayLabel: 'New Job',
      route: '/kanban',
      formData: { title: 'Test' },
      lastModified: Date.now(),
    };

    service.broadcastDraftUpdated('1:job:new', draft);

    expect(mockChannel.postMessage).toHaveBeenCalledWith({
      type: 'draft-updated',
      key: '1:job:new',
      draft,
    });
  });

  // ── broadcastDraftCleared ──

  it('broadcastDraftCleared should post message to channel', () => {
    service.broadcastDraftCleared('1:job:new');

    expect(mockChannel.postMessage).toHaveBeenCalledWith({
      type: 'draft-cleared',
      key: '1:job:new',
    });
  });

  // ── broadcastEntitySaved ──

  it('broadcastEntitySaved should post message to channel', () => {
    service.broadcastEntitySaved('job', '42');

    expect(mockChannel.postMessage).toHaveBeenCalledWith({
      type: 'entity-saved',
      entityType: 'job',
      entityId: '42',
    });
  });

  // ── onmessage ──

  it('should update lastEvent signal when message received', () => {
    expect(service.lastEvent()).toBeNull();

    const event = new MessageEvent('message', {
      data: { type: 'draft-cleared', key: '1:part:5' },
    });
    mockChannel.onmessage!(event);

    expect(service.lastEvent()).toEqual({ type: 'draft-cleared', key: '1:part:5' });
  });

  // ── ngOnDestroy ──

  it('should close channel on destroy', () => {
    service.ngOnDestroy();

    expect(mockChannel.close).toHaveBeenCalled();
  });
});
