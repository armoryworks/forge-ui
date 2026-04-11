import { TestBed } from '@angular/core/testing';
import { FormGroup, FormControl } from '@angular/forms';
import { signal } from '@angular/core';

import { DraftService } from './draft.service';
import { DraftStorageService } from './draft-storage.service';
import { DraftBroadcastService } from './draft-broadcast.service';
import { AuthService } from './auth.service';
import { UserPreferencesService } from './user-preferences.service';
import { SnackbarService } from './snackbar.service';
import { Draft } from '../models/draft.model';
import { DraftableForm } from '../models/draftable-form.model';

describe('DraftService', () => {
  let service: DraftService;
  let mockStorage: {
    get: ReturnType<typeof vi.fn>;
    getByUser: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    resetTtlForUser: ReturnType<typeof vi.fn>;
  };
  let mockBroadcast: {
    lastEvent: ReturnType<typeof signal>;
    broadcastDraftUpdated: ReturnType<typeof vi.fn>;
    broadcastDraftCleared: ReturnType<typeof vi.fn>;
    broadcastEntitySaved: ReturnType<typeof vi.fn>;
  };
  let mockAuth: { user: ReturnType<typeof signal<unknown>> };
  let mockPreferences: { get: ReturnType<typeof vi.fn> };
  let mockSnackbar: { info: ReturnType<typeof vi.fn> };

  const mockUser = { id: 1, firstName: 'John', lastName: 'Doe' };

  beforeEach(() => {
    mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      getByUser: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      resetTtlForUser: vi.fn().mockResolvedValue(undefined),
    };

    mockBroadcast = {
      lastEvent: signal(null),
      broadcastDraftUpdated: vi.fn(),
      broadcastDraftCleared: vi.fn(),
      broadcastEntitySaved: vi.fn(),
    };

    mockAuth = {
      user: signal(mockUser),
    };

    mockPreferences = {
      get: vi.fn().mockReturnValue(null),
    };

    mockSnackbar = {
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DraftService,
        { provide: DraftStorageService, useValue: mockStorage },
        { provide: DraftBroadcastService, useValue: mockBroadcast },
        { provide: AuthService, useValue: mockAuth },
        { provide: UserPreferencesService, useValue: mockPreferences },
        { provide: SnackbarService, useValue: mockSnackbar },
      ],
    });

    service = TestBed.inject(DraftService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('register', () => {
    it('should store active form reference', () => {
      const form = createMockDraftableForm();
      service.register(form);
      expect(service.activeDraftKey()).toBe(`${mockUser.id}:job:1`);
    });

    it('should set up beforeunload listener', () => {
      const addEventSpy = vi.spyOn(window, 'addEventListener');
      const form = createMockDraftableForm();
      service.register(form);
      expect(addEventSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      addEventSpy.mockRestore();
    });
  });

  describe('unregister', () => {
    it('should clear active form reference', () => {
      const form = createMockDraftableForm();
      service.register(form);
      expect(service.activeDraftKey()).toBe(`${mockUser.id}:job:1`);

      service.unregister('job', '1');
      expect(service.activeDraftKey()).toBeNull();
    });

    it('should remove beforeunload listener', () => {
      const removeEventSpy = vi.spyOn(window, 'removeEventListener');
      const form = createMockDraftableForm();
      service.register(form);
      service.unregister('job', '1');
      expect(removeEventSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      removeEventSpy.mockRestore();
    });
  });

  describe('saveDraft', () => {
    it('should call draftStorageService.put', async () => {
      const form = createMockDraftableForm();
      await service.saveDraft(form);

      expect(mockStorage.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: `${mockUser.id}:job:1`,
          userId: mockUser.id,
          entityType: 'job',
          entityId: '1',
          displayLabel: 'Test Job',
          route: '/kanban',
          formData: { title: 'Test' },
        }),
      );
    });

    it('should set hasDrafts to true', async () => {
      const form = createMockDraftableForm();
      await service.saveDraft(form);
      expect(service.hasDrafts()).toBe(true);
    });

    it('should broadcast draft update', async () => {
      const form = createMockDraftableForm();
      await service.saveDraft(form);
      expect(mockBroadcast.broadcastDraftUpdated).toHaveBeenCalledWith(
        `${mockUser.id}:job:1`,
        expect.any(Object),
      );
    });

    it('should not save if user is not authenticated', async () => {
      // Simulate no authenticated user by setting user signal to null
      (mockAuth.user as ReturnType<typeof signal>).set(null);

      const form = createMockDraftableForm();
      await service.saveDraft(form);
      expect(mockStorage.put).not.toHaveBeenCalled();

      // Restore for other tests
      (mockAuth.user as ReturnType<typeof signal>).set(mockUser);
    });
  });

  describe('loadDraft', () => {
    it('should call draftStorageService.get', async () => {
      const mockDraft: Draft = {
        key: `${mockUser.id}:job:1`,
        userId: mockUser.id,
        entityType: 'job',
        entityId: '1',
        displayLabel: 'Test Job',
        route: '/kanban',
        formData: { title: 'Test' },
        lastModified: Date.now(),
      };
      mockStorage.get.mockResolvedValue(mockDraft);

      const result = await service.loadDraft('job', '1');
      expect(mockStorage.get).toHaveBeenCalledWith(`${mockUser.id}:job:1`);
      expect(result).toBe(mockDraft);
    });

    it('should return null if user is not authenticated', async () => {
      (mockAuth.user as ReturnType<typeof signal>).set(null);

      const result = await service.loadDraft('job', '1');
      expect(result).toBeNull();
      expect(mockStorage.get).not.toHaveBeenCalled();

      // Restore for other tests
      (mockAuth.user as ReturnType<typeof signal>).set(mockUser);
    });
  });

  describe('clearDraft', () => {
    it('should call draftStorageService.delete', async () => {
      await service.clearDraft('job', '1');
      expect(mockStorage.delete).toHaveBeenCalledWith(`${mockUser.id}:job:1`);
    });

    it('should broadcast draft cleared', async () => {
      await service.clearDraft('job', '1');
      expect(mockBroadcast.broadcastDraftCleared).toHaveBeenCalledWith(`${mockUser.id}:job:1`);
    });
  });

  describe('clearDraftAndBroadcastSave', () => {
    it('should delete draft and broadcast entity saved', async () => {
      await service.clearDraftAndBroadcastSave('job', '1');
      expect(mockStorage.delete).toHaveBeenCalledWith(`${mockUser.id}:job:1`);
      expect(mockBroadcast.broadcastEntitySaved).toHaveBeenCalledWith('job', '1');
    });
  });

  describe('getUserDrafts', () => {
    it('should call draftStorageService.getByUser with current user id', async () => {
      await service.getUserDrafts();
      expect(mockStorage.getByUser).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('refreshHasDrafts', () => {
    it('should set hasDrafts to true when drafts exist', async () => {
      mockStorage.getByUser.mockResolvedValue([{ key: '1:job:1' }]);
      await service.refreshHasDrafts();
      expect(service.hasDrafts()).toBe(true);
    });

    it('should set hasDrafts to false when no drafts', async () => {
      mockStorage.getByUser.mockResolvedValue([]);
      await service.refreshHasDrafts();
      expect(service.hasDrafts()).toBe(false);
    });
  });

  function createMockDraftableForm(): DraftableForm {
    return {
      entityType: 'job',
      entityId: '1',
      displayLabel: 'Test Job',
      route: '/kanban',
      form: new FormGroup({
        title: new FormControl('Test'),
      }),
      isDirty: () => true,
      getFormSnapshot: () => ({ title: 'Test' }),
      restoreDraft: vi.fn(),
    };
  }
});
