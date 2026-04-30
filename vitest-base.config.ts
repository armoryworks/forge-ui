import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest base config consumed by `@angular/build:unit-test`.
 *
 * IMPORTANT: This file is the canonical Vitest config for `ng test`.
 * The Angular builder ignores `vitest.config.ts` entirely — it only
 * picks up `vitest-base.config.ts` (see configuration.js in
 * `@angular/build/src/builders/unit-test/runners/vitest`). Direct
 * `vitest` invocations would still see `vitest.config.ts`, but the
 * project standard is `ng test`, so this file is the single source.
 *
 * GLOBAL MODULE MOCKS — resolve.alias pattern:
 *   For external modules that must be globally mocked across every spec
 *   (e.g., transports like @microsoft/signalr that try to negotiate real
 *   HTTP in unit tests), use `resolve.alias` to redirect imports to a
 *   manual mock under `src/testing/`. This is the ONLY pattern that works
 *   reliably with Angular's unit-test runner: `vi.mock(...)` in a setup
 *   file conflicts with the runner's injected `vitest-mock-patch.js`
 *   wrapper, which breaks Vitest's stack-trace-based importer detection.
 *
 *   Per-spec `vi.mock(...)` still works for in-spec overrides (e.g., the
 *   holder pattern in signalr.service.spec.ts), and overrides this alias
 *   for that file.
 */
export default defineConfig({
  test: {
    // No `setupFiles` here — the Angular CLI ignores user-provided
    // setupFiles unless they're listed in angular.json `architect.test.options.setupFiles`.
    // The runner injects its own `init-testbed.js` and `vitest-mock-patch.js`
    // before any user spec runs. Adding a setup file here would NOT take effect.
  },
  resolve: {
    alias: {
      // Redirect every import of @microsoft/signalr (production code,
      // spec files, transitive imports) to the manual mock. See
      // src/testing/signalr.mock.ts for the rationale.
      '@microsoft/signalr': resolve(__dirname, 'src/testing/signalr.mock.ts'),
    },
  },
});
