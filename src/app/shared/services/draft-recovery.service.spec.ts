import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { DraftRecoveryService } from './draft-recovery.service';
import { DraftService } from './draft.service';
import { Draft } from '../models/draft.model';

describe('DraftRecoveryService', () => {
  let service: DraftRecoveryService;
  let mockDraftService: {
    refreshHasDrafts: ReturnType<typeof vi.fn>;
    getUserDrafts: ReturnType<typeof vi.fn>;
    getExpiredDrafts: ReturnType<typeof vi.fn>;
    resetAllTtl: ReturnType<typeof vi.fn>;
    clearDraft: ReturnType<typeof vi.fn>;
  };
  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigateByUrl: ReturnType<typeof vi.fn>;
  };

  const mockDraft: Draft = {
    key: '1:job:42',
    userId: 1,
    entityType: 'job',
    entityId: '42',
    displayLabel: 'Test Job - Edit',
    route: '/kanban?detail=job:42',
    formData: { title: 'Test' },
    lastModified: Date.now(),
  };

  beforeEach(() => {
    mockDraftService = {
      refreshHasDrafts: vi.fn().mockResolvedValue(undefined),
      getUserDrafts: vi.fn().mockResolvedValue([]),
      getExpiredDrafts: vi.fn().mockResolvedValue([]),
      resetAllTtl: vi.fn().mockResolvedValue(undefined),
      clearDraft: vi.fn().mockResolvedValue(undefined),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(undefined),
      }),
    };

    mockRouter = {
      navigateByUrl: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DraftRecoveryService,
        { provide: DraftService, useValue: mockDraftService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: Router, useValue: mockRouter },
      ],
    });

    service = TestBed.inject(DraftRecoveryService);
  });

  afterEach(() => {
    service.cancelTtlCheck();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('onLogin', () => {
    it('should refresh has drafts', async () => {
      await service.onLogin();
      expect(mockDraftService.refreshHasDrafts).toHaveBeenCalled();
    });

    it('should check for existing drafts', async () => {
      await service.onLogin();
      expect(mockDraftService.getUserDrafts).toHaveBeenCalled();
    });

    it('should show recovery prompt when drafts exist', async () => {
      mockDraftService.getUserDrafts.mockResolvedValue([mockDraft]);

      await service.onLogin();
      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          width: '520px',
          data: { drafts: [mockDraft], mode: 'recovery' },
        }),
      );
    });

    it('should not show recovery prompt when no drafts exist', async () => {
      mockDraftService.getUserDrafts.mockResolvedValue([]);

      await service.onLogin();
      expect(mockDialog.open).not.toHaveBeenCalled();
    });
  });

  describe('checkBeforeLogout', () => {
    it('should return true when no drafts exist', async () => {
      mockDraftService.getUserDrafts.mockResolvedValue([]);
      const result = await service.checkBeforeLogout();
      expect(result).toBe(true);
    });

    it('should check for dirty forms', async () => {
      mockDraftService.getUserDrafts.mockResolvedValue([mockDraft]);
      mockDialog.open.mockReturnValue({
        afterClosed: () => of({ action: 'cancel' }),
      });

      await service.checkBeforeLogout();
      expect(mockDraftService.getUserDrafts).toHaveBeenCalled();
    });

    it('should open logout drafts dialog when drafts exist', async () => {
      mockDraftService.getUserDrafts.mockResolvedValue([mockDraft]);
      mockDialog.open.mockReturnValue({
        afterClosed: () => of({ action: 'logout' }),
      });

      await service.checkBeforeLogout();
      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          width: '520px',
          data: { drafts: [mockDraft] },
        }),
      );
    });

    it('should return false when user cancels', async () => {
      mockDraftService.getUserDrafts.mockResolvedValue([mockDraft]);
      mockDialog.open.mockReturnValue({
        afterClosed: () => of({ action: 'cancel' }),
      });

      const result = await service.checkBeforeLogout();
      expect(result).toBe(false);
    });

    it('should return true when user confirms logout', async () => {
      mockDraftService.getUserDrafts.mockResolvedValue([mockDraft]);
      mockDialog.open.mockReturnValue({
        afterClosed: () => of({ action: 'logout' }),
      });

      const result = await service.checkBeforeLogout();
      expect(result).toBe(true);
    });

    it('should navigate and return false when user chooses navigate', async () => {
      mockDraftService.getUserDrafts.mockResolvedValue([mockDraft]);
      mockDialog.open.mockReturnValue({
        afterClosed: () => of({ action: 'navigate', draft: mockDraft }),
      });

      const result = await service.checkBeforeLogout();
      expect(result).toBe(false);
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith(mockDraft.route);
    });

    it('should return false when dialog is dismissed', async () => {
      mockDraftService.getUserDrafts.mockResolvedValue([mockDraft]);
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(undefined),
      });

      const result = await service.checkBeforeLogout();
      expect(result).toBe(false);
    });
  });

  describe('cancelTtlCheck', () => {
    it('should not throw when called without an active timer', () => {
      expect(() => service.cancelTtlCheck()).not.toThrow();
    });
  });
});
