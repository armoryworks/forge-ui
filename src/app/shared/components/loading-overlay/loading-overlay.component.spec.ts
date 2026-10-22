import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';

import { LoadingService } from '../../services/loading.service';
import { LoadingOverlayComponent } from './loading-overlay.component';
import { provideTranslateService } from '@ngx-translate/core';

describe('LoadingOverlayComponent', () => {
  let loading: LoadingService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [LoadingOverlayComponent], providers: [provideTranslateService()] });
    loading = TestBed.inject(LoadingService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(LoadingOverlayComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function overlay(host: HTMLElement): HTMLElement | null {
    return host.querySelector('[data-testid="loading-overlay"]');
  }

  it('blocks pointer events while the route has no content', () => {
    loading.start('route-navigation', 'Loading...', { blocking: true });

    const host = render();

    expect(overlay(host)?.classList.contains('loading-overlay--passive')).toBe(false);
  });

  it('lets clicks through to content that has already rendered', () => {
    loading.start('board', 'Loading board...');

    const host = render();

    expect(overlay(host)?.classList.contains('loading-overlay--passive')).toBe(true);
  });

  it('is removed as soon as loading ends, with no trailing display', () => {
    loading.start('board', 'Loading board...');
    const fixture = TestBed.createComponent(LoadingOverlayComponent);
    fixture.detectChanges();

    loading.stop('board');
    fixture.detectChanges();

    expect(overlay(fixture.nativeElement as HTMLElement)).toBeNull();
  });

  it('announces politely as a status with a translated label', () => {
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { common: { loading: 'Cargando...' } });
    translate.use('es');
    loading.start('route-navigation', 'Loading...', { blocking: true });

    const el = overlay(render());

    expect(el?.getAttribute('role')).toBe('status');
    expect(el?.getAttribute('aria-live')).toBe('polite');
    expect(el?.getAttribute('aria-label')).toBe('Cargando...');
  });
});
