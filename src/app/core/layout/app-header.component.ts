import { ChangeDetectionStrategy, Component, computed, inject, signal, HostListener, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, map, switchMap, catchError, of, EMPTY } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { ThemeService } from '../../shared/services/theme.service';
import { NotificationService } from '../../shared/services/notification.service';
import { AuthService } from '../../shared/services/auth.service';
import { LayoutService } from '../../shared/services/layout.service';
import { SearchService } from '../../shared/services/search.service';
import { AiService, AiSearchSuggestion } from '../../shared/services/ai.service';
import { LanguageService, SupportedLanguage } from '../../shared/services/language.service';
import { SearchResult } from '../../shared/models/search.model';
import { RagSearchResult } from '../../shared/models/rag-search-result.model';
import { NotificationPanelComponent } from '../../shared/components/notification-panel/notification-panel.component';
import { ChatComponent } from '../../features/chat/chat.component';
import { AiHelpPanelComponent } from '../../shared/components/ai-help-panel/ai-help-panel.component';
import { TrainingContextPanelComponent } from '../../shared/components/training-context-panel/training-context-panel.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatTooltipModule, TranslatePipe, NotificationPanelComponent, ChatComponent, AiHelpPanelComponent, TrainingContextPanelComponent],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  protected readonly layout = inject(LayoutService);
  private readonly searchService = inject(SearchService);
  protected readonly aiService = inject(AiService);
  protected readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);

  protected readonly themeIcon = computed(() =>
    this.themeService.theme() === 'light' ? 'dark_mode' : 'light_mode',
  );

  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly panelOpen = this.notificationService.panelOpen;
  protected readonly logoUrl = this.themeService.logoUrl;
  protected readonly currentUser = this.authService.user;
  protected readonly userMenuOpen = signal(false);
  protected readonly showTrainingPanel = signal(false);
  protected readonly currentRoute = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url.split('?')[0]),
    ),
    { initialValue: this.router.url.split('?')[0] },
  );
  protected readonly currentLanguage = this.languageService.currentLanguage;
  protected readonly availableLanguages = this.languageService.availableLanguages;

  protected readonly userInitials = computed(() => this.currentUser()?.initials ?? '?');
  protected readonly userAvatarColor = computed(() => this.currentUser()?.avatarColor ?? 'var(--accent)');
  protected readonly userFullName = computed(() => {
    const u = this.currentUser();
    return u ? `${u.lastName}, ${u.firstName}` : '';
  });
  protected readonly userEmail = computed(() => this.currentUser()?.email ?? '');
  protected readonly userRoles = computed(() => this.currentUser()?.roles.join(', ') ?? '');

  protected readonly searchControl = new FormControl('');
  protected readonly searchResults = signal<SearchResult[]>([]);
  protected readonly aiSuggestions = signal<AiSearchSuggestion[]>([]);
  protected readonly ragResults = signal<RagSearchResult[]>([]);
  protected readonly ragAnswer = signal<string | null>(null);
  protected readonly aiLoading = signal(false);
  protected readonly showResults = signal(false);
  protected readonly searchFocused = signal(false);

  ngOnInit(): void {
    this.aiService.checkAvailability();
  }

  constructor() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => (v?.length ?? 0) >= 2),
      switchMap(term => this.searchService.search(term!)),
    ).subscribe(results => {
      this.searchResults.set(results);
      this.showResults.set(results.length > 0 || this.aiService.available() || this.aiSuggestions().length > 0);
    });

    this.searchControl.valueChanges.pipe(
      debounceTime(600),
      distinctUntilChanged(),
      filter(v => (v?.length ?? 0) >= 2),
      filter(() => this.aiService.available()),
      switchMap(term => {
        this.aiLoading.set(true);
        this.showResults.set(true);
        return this.aiService.ragSearch(term!, undefined, true).pipe(
          catchError(() => of({ results: [] as RagSearchResult[], generatedAnswer: null })),
        );
      }),
    ).subscribe(response => {
      this.ragResults.set(response.results);
      this.ragAnswer.set(response.generatedAnswer);
      this.aiLoading.set(false);
      this.showResults.set(
        this.searchResults().length > 0 || response.results.length > 0 || !!response.generatedAnswer,
      );
    });

    this.searchControl.valueChanges.pipe(
      filter(v => !v || v.length < 2),
    ).subscribe(() => {
      this.aiSuggestions.set([]);
      this.ragResults.set([]);
      this.ragAnswer.set(null);
      this.aiLoading.set(false);
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      const input = document.querySelector<HTMLInputElement>('.search-input');
      input?.focus();
    }
  }

  protected onSearchFocus(): void {
    this.searchFocused.set(true);
    if (this.searchResults().length > 0 || this.aiSuggestions().length > 0 || this.ragResults().length > 0 || this.ragAnswer()) {
      this.showResults.set(true);
    }
  }

  protected onSearchBlur(): void {
    this.searchFocused.set(false);
    setTimeout(() => this.showResults.set(false), 200);
  }

  protected navigateToResult(result: SearchResult): void {
    this.showResults.set(false);
    this.searchControl.setValue('', { emitEvent: false });
    this.searchResults.set([]);
    this.aiSuggestions.set([]);
    this.router.navigateByUrl(result.url);
  }

  protected navigateToSuggestion(suggestion: AiSearchSuggestion): void {
    this.showResults.set(false);
    this.searchControl.setValue('', { emitEvent: false });
    this.searchResults.set([]);
    this.aiSuggestions.set([]);
    this.router.navigateByUrl(suggestion.url);
  }

  protected navigateToRagResult(result: RagSearchResult): void {
    this.showResults.set(false);
    this.searchControl.setValue('', { emitEvent: false });
    this.searchResults.set([]);
    this.ragResults.set([]);
    this.ragAnswer.set(null);
    const url = this.getEntityRoute(result.entityType, result.entityId);
    if (url) {
      this.router.navigateByUrl(url);
    }
  }

  protected getEntityRoute(entityType: string, entityId: number): string {
    const routeMap: Record<string, string> = {
      job: '/kanban',
      part: '/parts',
      customer: '/customers',
      lead: '/leads',
      asset: '/assets',
      expense: '/expenses',
      vendor: '/vendors',
      'sales-order': '/sales-orders',
      'purchase-order': '/purchase-orders',
      quote: '/quotes',
      shipment: '/shipments',
      invoice: '/invoices',
    };
    const base = routeMap[entityType.toLowerCase()];
    return base ? `${base}/${entityId}` : `/${entityType.toLowerCase()}s`;
  }

  protected getEntityIcon(entityType: string): string {
    const iconMap: Record<string, string> = {
      job: 'work',
      part: 'inventory_2',
      customer: 'person',
      lead: 'handshake',
      asset: 'precision_manufacturing',
      expense: 'receipt_long',
      vendor: 'store',
      'sales-order': 'shopping_cart',
      'purchase-order': 'receipt',
      quote: 'request_quote',
      shipment: 'local_shipping',
      invoice: 'description',
    };
    return iconMap[entityType.toLowerCase()] ?? 'article';
  }

  protected getScorePercent(score: number): number {
    return Math.round(score * 100);
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected toggleNotifications(): void {
    this.notificationService.togglePanel();
  }

  protected toggleTrainingPanel(): void {
    this.showTrainingPanel.update(v => !v);
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update(v => !v);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  protected switchLanguage(lang: SupportedLanguage): void {
    this.languageService.setLanguage(lang);
  }

  protected logout(): void {
    this.userMenuOpen.set(false);
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  protected goToAccount(): void {
    this.userMenuOpen.set(false);
    this.router.navigate(['/account']);
  }

}
