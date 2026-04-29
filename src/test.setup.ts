// Required for Angular JIT compilation of component templates in unit tests
import '@angular/compiler';

// jsdom does not implement window.matchMedia — provide a stub
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

// `destroyAfterEach: false` works around a known Angular 21 + Vitest
// teardown race: HTTP interceptors dispatch work in a microtask that
// completes after TestBed destroys its injector, surfacing as
// `NG0205: Injector has already been destroyed`. Per-spec
// `beforeEach(TestBed.configureTestingModule(...))` still gives each
// `it` a fresh provider configuration; only the bare TestBed root
// outlives.
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
  { teardown: { destroyAfterEach: false } },
);
