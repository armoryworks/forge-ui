import { signal, WritableSignal } from '@angular/core';

/**
 * Workflow Pattern Phase 5 — Vitest signal-input harness helper.
 *
 * Phase 4's `WorkflowComponent.spec.ts` discovered that this codebase's
 * Vitest harness has a known brittleness with `componentRef.setInput` for
 * `input()`-declared signal inputs (the JIT compiler doesn't resolve input
 * metadata reliably under the inline-resources transform). Phase 4 worked
 * around this with hand-rolled `Object.defineProperty` blocks per spec.
 * Phase 5 generalizes that pattern into a small reusable helper so future
 * step-component specs don't repeat the boilerplate.
 *
 * Usage:
 * ```typescript
 * const component = TestBed.runInInjectionContext(() => new MyStepComponent());
 * const inputs = mockSignalInputs(component, {
 *   stepId: 'basics',
 *   entityId: 42,
 *   entity: { description: 'Widget' },
 * });
 * // Drive inputs from a test:
 * inputs.entity.set({ description: 'Updated' });
 * ```
 *
 * The helper replaces each named property on the component instance with a
 * `WritableSignal` that's also a function (Angular's existing input shape
 * is "callable signal" — `this.entity()`). Tests can read via the field
 * (`component.entity()`) and write via the returned signal map
 * (`inputs.entity.set(...)`).
 *
 * This complements (does not replace) `componentRef.setInput` — when the
 * harness is fixed upstream this helper becomes redundant; both shapes
 * coexist gracefully because both use signals.
 */
export function mockSignalInputs<T extends Record<string, unknown>>(
  component: object,
  initial: T,
): { [K in keyof T]: WritableSignal<T[K]> } {
  const out: Record<string, WritableSignal<unknown>> = {};
  for (const key of Object.keys(initial)) {
    const sig = signal<unknown>(initial[key as keyof T]);
    Object.defineProperty(component, key, { value: sig, writable: true, configurable: true });
    out[key] = sig;
  }
  return out as { [K in keyof T]: WritableSignal<T[K]> };
}
