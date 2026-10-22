import { ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

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
import { NavItem } from '../../shared/models/nav-item.model';

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
        { provide: NavTreeService, useValue: { breadcrumbTrail: signal([]), flatLeaves: signal([]), recordCrumb: signal(null) } },
        { provide: ThemeService, useValue: { theme: signal('light') } },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
        { provide: AiService, useValue: { available: signal(false) } },
        { provide: SearchService, useValue: {} },
        { provide: VersionService, useValue: {} },
        { provide: BrandingService, useValue: {} },
        { provide: LayoutService, useValue: {} },
        { provide: MatDialog, useValue: { openDialogs: [] } },
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

describe('AppHeaderComponent breadcrumb', () => {
  const trail: NavItem[] = [
    { icon: 'sell', label: 'Sales', i18nKey: 'navGroups.sales', route: '/customers' },
    { icon: 'people', label: 'Customers', i18nKey: 'nav.customers', route: '/customers' },
    { icon: 'list', label: 'All Customers', i18nKey: 'nav.customersAll', route: '/customers' },
  ];
  let recordCrumb: ReturnType<typeof signal<string | null>>;
  let component: { visibleCrumbs(): NavItem[]; hiddenCrumbs(): NavItem[]; recordCrumb(): string | null };

  beforeEach(() => {
    recordCrumb = signal<string | null>(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal(null), logout: vi.fn() } },
        { provide: Router, useValue: { events: of(), url: '/customers/12/overview', navigate: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
        { provide: LanguageService, useValue: { currentLanguage: signal('en'), availableLanguages: [] } },
        { provide: NotificationService, useValue: { unreadCount: signal(0), panelOpen: signal(false) } },
        { provide: NavTreeService, useValue: { breadcrumbTrail: signal(trail), flatLeaves: signal([]), recordCrumb } },
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

  it('shows the last two navigation crumbs when the page names no record', () => {
    expect(component.visibleCrumbs().map(c => c.i18nKey)).toEqual(['nav.customers', 'nav.customersAll']);
    expect(component.recordCrumb()).toBeNull();
  });

  it('ends the trail with the record name and keeps the same number of visible crumbs', () => {
    recordCrumb.set('Acme Tooling');

    expect(component.recordCrumb()).toBe('Acme Tooling');
    expect(component.visibleCrumbs().map(c => c.i18nKey)).toEqual(['nav.customersAll']);
    expect(component.hiddenCrumbs().map(c => c.i18nKey)).toEqual(['navGroups.sales', 'nav.customers']);
  });
});

describe('AppHeaderComponent search', () => {
  type SearchHarness = {
    searchControl: { setValue(v: string): void; value: string | null };
    searchResults: () => unknown[];
    searchFailed: () => boolean;
    showResults: { (): boolean; set(v: boolean): void };
    onSearchEscape(e: Event): void;
  };
  let search: ReturnType<typeof vi.fn>;
  let component: SearchHarness;

  beforeEach(() => {
    vi.useFakeTimers();
    search = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal(null) } },
        { provide: Router, useValue: { events: of(), url: '/dashboard', navigate: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
        { provide: LanguageService, useValue: { currentLanguage: signal('en'), availableLanguages: [] } },
        { provide: NotificationService, useValue: { unreadCount: signal(0), panelOpen: signal(false) } },
        { provide: NavTreeService, useValue: { breadcrumbTrail: signal([]), flatLeaves: signal([]), recordCrumb: signal(null) } },
        { provide: ThemeService, useValue: { theme: signal('light') } },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
        { provide: AiService, useValue: { available: signal(false) } },
        { provide: SearchService, useValue: { search } },
        { provide: VersionService, useValue: {} },
        { provide: BrandingService, useValue: {} },
        { provide: LayoutService, useValue: {} },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AppHeaderComponent()) as unknown as SearchHarness;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops the previous results when the term is cut back below two characters', () => {
    search.mockReturnValue(of([{ entityType: 'job', entityId: 1, title: 'J-1' }]));
    component.searchControl.setValue('J-1');
    vi.advanceTimersByTime(300);
    expect(component.searchResults().length).toBe(1);

    component.searchControl.setValue('J');
    expect(component.searchResults()).toEqual([]);
    expect(component.showResults()).toBe(false);
  });

  it('shows an error, not an empty result, when a search fails, and keeps searching', () => {
    search.mockReturnValueOnce(throwError(() => new Error('500')));
    component.searchControl.setValue('J-1');
    vi.advanceTimersByTime(300);
    expect(component.searchResults()).toEqual([]);
    expect(component.searchFailed()).toBe(true);
    expect(component.showResults()).toBe(true);

    search.mockReturnValue(of([{ entityType: 'job', entityId: 15, title: 'J-15' }]));
    component.searchControl.setValue('J-15');
    vi.advanceTimersByTime(300);
    expect(component.searchResults().length).toBe(1);
    expect(component.searchFailed()).toBe(false);
  });

  it('closes the results on Escape, then clears the term on a second Escape', () => {
    component.searchControl.setValue('J-1');
    component.showResults.set(true);
    const first = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    component.onSearchEscape(first);
    expect(component.showResults()).toBe(false);
    expect(first.defaultPrevented).toBe(true);
    expect(component.searchControl.value).toBe('J-1');

    component.onSearchEscape(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(component.searchControl.value).toBe('');
  });
});

describe('AppHeaderComponent Escape', () => {
  interface HeaderInternals {
    onKeydown(event: KeyboardEvent): void;
    userMenuOpen: { (): boolean; set(v: boolean): void };
    showTrainingPanel: { (): boolean; set(v: boolean): void };
  }

  let header: HeaderInternals;
  let openDialogs: unknown[];
  let notificationsOpen: ReturnType<typeof signal<boolean>>;
  let mobileMenuOpen: ReturnType<typeof signal<boolean>>;
  let aiOpen: ReturnType<typeof signal<boolean>>;
  let chatOpen: ReturnType<typeof signal<boolean>>;
  let trigger: HTMLButtonElement;
  let inlineDialog: HTMLElement | null;

  beforeEach(() => {
    openDialogs = [];
    inlineDialog = null;
    notificationsOpen = signal(false);
    mobileMenuOpen = signal(false);
    aiOpen = signal(false);
    chatOpen = signal(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal(null) } },
        { provide: Router, useValue: { events: of(), url: '/dashboard' } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
        { provide: LanguageService, useValue: { currentLanguage: signal('en'), availableLanguages: [] } },
        { provide: NotificationService, useValue: { unreadCount: signal(0), panelOpen: notificationsOpen, closePanel: () => notificationsOpen.set(false) } },
        { provide: NavTreeService, useValue: { breadcrumbTrail: signal([]), flatLeaves: signal([]) } },
        { provide: ThemeService, useValue: { theme: signal('light') } },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
        { provide: AiService, useValue: { available: signal(false) } },
        { provide: SearchService, useValue: {} },
        { provide: VersionService, useValue: {} },
        { provide: BrandingService, useValue: {} },
        { provide: LayoutService, useValue: { mobileMenuOpen, closeMobileMenu: () => mobileMenuOpen.set(false) } },
        { provide: MatDialog, useValue: { openDialogs } },
      ],
    });
    header = TestBed.runInInjectionContext(() => new AppHeaderComponent()) as unknown as HeaderInternals;
    trigger = document.createElement('button');
    document.body.appendChild(trigger);
    Object.defineProperty(header, 'userTrigger', { value: () => new ElementRef(trigger) });
    Object.defineProperty(header, 'aiHelpPanel', { value: () => ({ open: aiOpen, toggle: () => aiOpen.update(v => !v) }) });
    Object.defineProperty(header, 'chatPanel', { value: () => ({ panelOpen: chatOpen, toggle: () => chatOpen.update(v => !v) }) });
  });

  afterEach(() => {
    trigger.remove();
    inlineDialog?.remove();
  });

  function pressEscape(): void {
    header.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
  }

  it('closes the user menu and returns focus to its trigger', () => {
    header.userMenuOpen.set(true);

    pressEscape();

    expect(header.userMenuOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes one panel per press, topmost first', () => {
    header.showTrainingPanel.set(true);
    aiOpen.set(true);
    chatOpen.set(true);
    mobileMenuOpen.set(true);
    notificationsOpen.set(true);

    pressEscape();
    expect(notificationsOpen()).toBe(false);
    expect(header.showTrainingPanel()).toBe(true);

    pressEscape();
    expect(header.showTrainingPanel()).toBe(false);
    expect(aiOpen()).toBe(true);

    pressEscape();
    expect(aiOpen()).toBe(false);
    expect(chatOpen()).toBe(true);

    pressEscape();
    expect(chatOpen()).toBe(false);
    expect(mobileMenuOpen()).toBe(true);

    pressEscape();
    expect(mobileMenuOpen()).toBe(false);
  });

  it('leaves the menu open when another control already handled the Escape', () => {
    header.userMenuOpen.set(true);
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    event.preventDefault();

    header.onKeydown(event);

    expect(header.userMenuOpen()).toBe(true);
  });

  it('leaves the menu open while a MatDialog owns Escape', () => {
    openDialogs.push({});
    header.userMenuOpen.set(true);

    pressEscape();

    expect(header.userMenuOpen()).toBe(true);
  });

  it('leaves the menu open while an inline dialog owns Escape', () => {
    inlineDialog = document.createElement('app-dialog');
    document.body.appendChild(inlineDialog);
    header.userMenuOpen.set(true);

    pressEscape();

    expect(header.userMenuOpen()).toBe(true);
  });
});
