import { ChangeDetectionStrategy, Component, computed, inject, signal, HostListener, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, switchMap, catchError, of, EMPTY } from 'rxjs';

import { ThemeService } from '../../shared/services/theme.service';
import { NotificationService } from '../../shared/services/notification.service';
import { LayoutService } from '../../shared/services/layout.service';
import { SearchService } from '../../shared/services/search.service';
import { AiService, AiSearchSuggestion } from '../../shared/services/ai.service';
import { SearchResult } from '../../shared/models/search.model';
import { NotificationPanelComponent } from '../../shared/components/notification-panel/notification-panel.component';
import { ChatComponent } from '../../features/chat/chat.component';
import { AiHelpPanelComponent } from '../../shared/components/ai-help-panel/ai-help-panel.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ReactiveFormsModule, NotificationPanelComponent, ChatComponent, AiHelpPanelComponent],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly notificationService = inject(NotificationService);
  protected readonly layout = inject(LayoutService);
  private readonly searchService = inject(SearchService);
  protected readonly aiService = inject(AiService);
  private readonly router = inject(Router);

  protected readonly themeIcon = computed(() =>
    this.themeService.theme() === 'light' ? 'dark_mode' : 'light_mode',
  );

  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly panelOpen = this.notificationService.panelOpen;
  protected readonly logoUrl = this.themeService.logoUrl;

  protected readonly searchControl = new FormControl('');
  protected readonly searchResults = signal<SearchResult[]>([]);
  protected readonly aiSuggestions = signal<AiSearchSuggestion[]>([]);
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
        return this.aiService.searchSuggest(term!).pipe(
          catchError(() => of([] as AiSearchSuggestion[])),
        );
      }),
    ).subscribe(suggestions => {
      this.aiSuggestions.set(suggestions);
      this.aiLoading.set(false);
      this.showResults.set(
        this.searchResults().length > 0 || suggestions.length > 0,
      );
    });

    this.searchControl.valueChanges.pipe(
      filter(v => !v || v.length < 2),
    ).subscribe(() => {
      this.aiSuggestions.set([]);
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
    if (this.searchResults().length > 0 || this.aiSuggestions().length > 0) {
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

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected toggleNotifications(): void {
    this.notificationService.togglePanel();
  }

}
