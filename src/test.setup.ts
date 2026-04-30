// NOTE: This file is wired up via `vitest.config.ts` for direct `vitest`
// invocations only. The project standard is `ng test`, which uses the
// `@angular/build:unit-test` builder — that builder IGNORES this file
// (it only reads `vitest-base.config.ts` and `architect.test.options.setupFiles`
// in angular.json). The runner injects its own `init-testbed.js` to call
// `getTestBed().initTestEnvironment(...)` before any spec runs, so the
// duplicate init below is a no-op under `ng test`.
//
// Global module mocks (e.g., @microsoft/signalr) belong in `vitest-base.config.ts`
// via `resolve.alias` — see `src/testing/signalr.mock.ts` for the canonical
// pattern. `vi.mock(...)` in this file is incompatible with the runner's
// injected `vitest-mock-patch.js` wrapper.

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
