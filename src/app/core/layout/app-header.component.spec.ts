import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AiService } from '../../shared/services/ai.service';
import { AuthService } from '../../shared/services/auth.service';
import { BrandingService } from '../../shared/services/branding.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { LanguageService } from '../../shared/services/language.service';
import { LayoutService } from '../../shared/services/layout.service';
import { NavTreeService } from '../../shared/services/nav-tree.service';
import { NotificationService } from '../../shared/services/notification.service';
import { SearchService } from '../../shared/services/search.service';
import { ThemeService } from '../../shared/services/theme.service';
import { VersionService } from '../../shared/services/version.service';
import { AppHeaderComponent } from './app-header.component';

describe('AppHeaderComponent logout', () => {
  let logout: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let component: { logout(): Promise<void>; userMenuOpen: { (): boolean; set(v: boolean): void } };

  beforeEach(() => {
    logout = vi.fn();
    navigate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal(null), logout } },
        { provide: Router, useValue: { events: of(), url: '/dashboard', navigate } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
        { provide: LanguageService, useValue: { currentLanguage: signal('en'), availableLanguages: [] } },
        { provide: NotificationService, useValue: { unreadCount: signal(0), panelOpen: signal(false) } },
        { provide: NavTreeService, useValue: { breadcrumbTrail: signal([]), flatLeaves: signal([]) } },
        { provide: ThemeService, useValue: { theme: signal('light') } },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
        { provide: AiService, useValue: { available: signal(false) } },
        { provide: SearchService, useValue: {} },
        { provide: VersionService, useValue: {} },
        { provide: BrandingService, useValue: {} },
        { provide: LayoutService, useValue: {} },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AppHeaderComponent()) as unknown as typeof component;
  });

  it('navigates to /login only after the logout has actually happened', async () => {
    let finish!: (done: boolean) => void;
    logout.mockReturnValue(new Promise<boolean>(resolve => { finish = resolve; }));
    component.userMenuOpen.set(true);

    const pending = component.logout();
    expect(component.userMenuOpen()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();

    finish(true);
    await pending;
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('stays on the current page when the unsaved-drafts dialog cancels the logout', async () => {
    logout.mockResolvedValue(false);

    await component.logout();

    expect(navigate).not.toHaveBeenCalled();
  });
});
