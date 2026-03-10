import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { BroadcastService } from './broadcast.service';
import { AuthService } from './auth.service';
import { ThemeService, ThemeMode } from './theme.service';
import { SignalrService } from './signalr.service';

describe('BroadcastService', () => {
  let service: BroadcastService;
  let authService: AuthService;
  let themeService: ThemeService;
  let signalrService: SignalrService;
  let router: Router;

  // Mock BroadcastChannel
  let mockChannel: {
    postMessage: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
  };

  beforeEach(() => {
    mockChannel = {
      postMessage: vi.fn(),
      close: vi.fn(),
      onmessage: null,
    };

    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn().mockImplementation(() => mockChannel),
    );

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: { navigate: vi.fn() },
        },
      ],
    });

    service = TestBed.inject(BroadcastService);
    authService = TestBed.inject(AuthService);
    themeService = TestBed.inject(ThemeService);
    signalrService = TestBed.inject(SignalrService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.unstubAllGlobals();
  });

  describe('initialize', () => {
    it('should create a BroadcastChannel with the correct name', () => {
      service.initialize();

      expect(BroadcastChannel).toHaveBeenCalledWith('qb-engineer-sync');
    });

    it('should register a broadcast callback on AuthService', () => {
      const spy = vi.spyOn(authService, 'registerBroadcastCallback');

      service.initialize();

      expect(spy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should register a broadcast callback on ThemeService', () => {
      const spy = vi.spyOn(themeService, 'registerBroadcastCallback');

      service.initialize();

      expect(spy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not create a channel if BroadcastChannel is undefined', () => {
      vi.stubGlobal('BroadcastChannel', undefined);

      service.initialize();

      // Should not throw and no channel interactions
      expect(mockChannel.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('logout broadcast', () => {
    it('should post logout message when auth broadcast callback fires', () => {
      let broadcastCallback: (() => void) | undefined;
      vi.spyOn(authService, 'registerBroadcastCallback').mockImplementation(
        (fn) => {
          broadcastCallback = fn;
        },
      );

      service.initialize();
      broadcastCallback!();

      expect(mockChannel.postMessage).toHaveBeenCalledWith({ type: 'logout' });
    });

    it('should clear auth, stop SignalR, and navigate to login on incoming logout', () => {
      const clearAuthSpy = vi.spyOn(authService, 'clearAuth');
      const stopAllSpy = vi.spyOn(signalrService, 'stopAll');

      service.initialize();

      // Simulate incoming message from another tab
      mockChannel.onmessage!(
        new MessageEvent('message', { data: { type: 'logout' } }),
      );

      expect(clearAuthSpy).toHaveBeenCalled();
      expect(stopAllSpy).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('theme-change broadcast', () => {
    it('should post theme-change message when theme broadcast callback fires', () => {
      let broadcastCallback: ((theme: ThemeMode) => void) | undefined;
      vi.spyOn(themeService, 'registerBroadcastCallback').mockImplementation(
        (fn) => {
          broadcastCallback = fn;
        },
      );

      service.initialize();
      broadcastCallback!('dark');

      expect(mockChannel.postMessage).toHaveBeenCalledWith({
        type: 'theme-change',
        theme: 'dark',
      });
    });

    it('should apply theme from broadcast on incoming theme-change', () => {
      const applyThemeSpy = vi.spyOn(themeService, 'applyThemeFromBroadcast');

      service.initialize();

      mockChannel.onmessage!(
        new MessageEvent('message', {
          data: { type: 'theme-change', theme: 'dark' },
        }),
      );

      expect(applyThemeSpy).toHaveBeenCalledWith('dark');
    });

    it('should handle light theme changes', () => {
      const applyThemeSpy = vi.spyOn(themeService, 'applyThemeFromBroadcast');

      service.initialize();

      mockChannel.onmessage!(
        new MessageEvent('message', {
          data: { type: 'theme-change', theme: 'light' },
        }),
      );

      expect(applyThemeSpy).toHaveBeenCalledWith('light');
    });
  });

  describe('ngOnDestroy', () => {
    it('should close the channel on destroy', () => {
      service.initialize();

      service.ngOnDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
    });

    it('should handle destroy when no channel was created', () => {
      // Never initialized — should not throw
      expect(() => service.ngOnDestroy()).not.toThrow();
    });
  });
});
