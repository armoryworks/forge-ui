import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { TelemetryConsentDialogComponent } from './telemetry-consent-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

/**
 * Constructed rather than rendered. This repo's TestBed does not apply input
 * bindings — a bound signal input still reads null after change detection, which is
 * also why the shared `app-input` / `app-validation-button` wrappers throw NG0950
 * whenever a spec tries to render them. So this covers the component's own behaviour,
 * and the agreement's CONTENT is asserted server-side in TelemetryConsentTests, where
 * the text actually lives.
 */
interface DialogInternals {
  showPayload(): boolean;
  payloadToggleKey(): string;
  togglePayload(): void;
}

function create() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideNoopAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });

  const component = TestBed.runInInjectionContext(() => new TelemetryConsentDialogComponent());
  return { component, internals: component as unknown as DialogInternals };
}

describe('TelemetryConsentDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('hides the sample payload until asked for it', () => {
    // Collapsed by default so the agreement reads as prose; expandable so the
    // "health only" claim is checkable rather than merely asserted.
    const { internals } = create();

    expect(internals.showPayload()).toBe(false);
    expect(internals.payloadToggleKey()).toBe('admin.telemetry.showPayload');
  });

  it('toggles the payload both ways', () => {
    const { internals } = create();

    internals.togglePayload();
    expect(internals.showPayload()).toBe(true);
    expect(internals.payloadToggleKey()).toBe('admin.telemetry.hidePayload');

    internals.togglePayload();
    expect(internals.showPayload()).toBe(false);
  });

  it('renders nothing until an agreement is supplied', () => {
    // Nullable rather than required: a consent dialog must never half-render against
    // a missing agreement, which would show buttons with no terms above them.
    const { component } = create();

    expect(component.agreement()).toBeNull();
  });

  it('emits accept and decline as distinct decisions', () => {
    const { component } = create();
    const decisions: boolean[] = [];
    component.decided.subscribe((v: boolean) => decisions.push(v));

    component.decided.emit(true);
    component.decided.emit(false);

    expect(decisions).toEqual([true, false]);
  });

  it('closing is separate from deciding, so a dismissal records nothing', () => {
    // Closing must not be filed as a decline — that would put an answer in the
    // consent record the operator never gave.
    const { component } = create();
    const decisions: boolean[] = [];
    component.decided.subscribe((v: boolean) => decisions.push(v));
    let closed = 0;
    component.closed.subscribe(() => closed++);

    component.closed.emit();

    expect(closed).toBe(1);
    expect(decisions).toEqual([]);
  });
});
