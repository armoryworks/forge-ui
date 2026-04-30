import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';

import {
  NewPartForkDialogComponent,
  NewPartForkResult,
} from './new-part-fork-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface ForkInternals {
  partType(): string | null;
  modeOverride(): 'express' | 'guided' | null;
  defaultMode(): 'express' | 'guided';
  effectiveMode(): 'express' | 'guided';
  canContinue(): boolean;
  pickPartType(t: 'Assembly' | 'RawMaterial' | 'Part' | 'Other'): void;
  pickMode(m: 'express' | 'guided'): void;
  continue(): void;
  close(): void;
}

function setup() {
  const dialogRef = {
    close: vi.fn(),
  } as unknown as MatDialogRef<NewPartForkDialogComponent, NewPartForkResult | undefined>;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [NewPartForkDialogComponent],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });

  const fixture = TestBed.createComponent(NewPartForkDialogComponent);
  fixture.detectChanges();
  const component = fixture.componentInstance as unknown as ForkInternals;
  return { fixture, component, dialogRef };
}

describe('NewPartForkDialogComponent (Phase 6 — type-aware fork)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('starts with no Q1 / Q2 picked and Continue disabled', () => {
    const { component } = setup();
    expect(component.partType()).toBeNull();
    expect(component.modeOverride()).toBeNull();
    expect(component.canContinue()).toBe(false);
    // Until the user picks Q1, the default mode is 'express' (the safe
    // default for unknown types).
    expect(component.defaultMode()).toBe('express');
    expect(component.effectiveMode()).toBe('express');
  });

  it('Raw Material → Express is the recommended default (D3)', () => {
    const { component } = setup();
    component.pickPartType('RawMaterial');
    expect(component.defaultMode()).toBe('express');
    expect(component.effectiveMode()).toBe('express');
    expect(component.canContinue()).toBe(true);
  });

  it('Assembly → Step-by-step (guided) is the recommended default (D3)', () => {
    const { component } = setup();
    component.pickPartType('Assembly');
    expect(component.defaultMode()).toBe('guided');
    expect(component.effectiveMode()).toBe('guided');
    expect(component.canContinue()).toBe(true);
  });

  it('Made Part → Express is the recommended default (D3 — fallback)', () => {
    const { component } = setup();
    component.pickPartType('Part');
    expect(component.defaultMode()).toBe('express');
    expect(component.effectiveMode()).toBe('express');
  });

  it('Other → Express is the recommended default (D3 — fallback)', () => {
    const { component } = setup();
    component.pickPartType('Other');
    expect(component.defaultMode()).toBe('express');
    expect(component.effectiveMode()).toBe('express');
  });

  it('user override of Q2 wins over the Q1 default (Raw Material → guided override)', () => {
    const { component } = setup();
    component.pickPartType('RawMaterial');
    expect(component.effectiveMode()).toBe('express');
    component.pickMode('guided');
    expect(component.modeOverride()).toBe('guided');
    expect(component.effectiveMode()).toBe('guided');
    // Default doesn't change — only the override does.
    expect(component.defaultMode()).toBe('express');
  });

  it('user override of Q2 stays sticky when Q1 changes', () => {
    const { component } = setup();
    component.pickPartType('Assembly');
    component.pickMode('express'); // override the guided default
    expect(component.effectiveMode()).toBe('express');

    // User reconsiders Q1, picks Raw Material instead. The Q2 override
    // is sticky — the user's explicit pick wins.
    component.pickPartType('RawMaterial');
    expect(component.modeOverride()).toBe('express');
    expect(component.effectiveMode()).toBe('express');
  });

  it('continue() emits {partType, mode} matching Q1 + effectiveMode', () => {
    const { component, dialogRef } = setup();
    component.pickPartType('Assembly');
    component.continue();
    expect(dialogRef.close).toHaveBeenCalledWith({ partType: 'Assembly', mode: 'guided' });
  });

  it('continue() with Raw Material + default emits express', () => {
    const { component, dialogRef } = setup();
    component.pickPartType('RawMaterial');
    component.continue();
    expect(dialogRef.close).toHaveBeenCalledWith({ partType: 'RawMaterial', mode: 'express' });
  });

  it('continue() with Raw Material + guided override emits guided', () => {
    const { component, dialogRef } = setup();
    component.pickPartType('RawMaterial');
    component.pickMode('guided');
    component.continue();
    expect(dialogRef.close).toHaveBeenCalledWith({ partType: 'RawMaterial', mode: 'guided' });
  });

  it('Other UI bucket maps to Consumable on the wire', () => {
    const { component, dialogRef } = setup();
    component.pickPartType('Other');
    component.continue();
    expect(dialogRef.close).toHaveBeenCalledWith({ partType: 'Consumable', mode: 'express' });
  });

  it('continue() is a no-op when Q1 is not picked', () => {
    const { component, dialogRef } = setup();
    component.continue();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('close() emits undefined', () => {
    const { component, dialogRef } = setup();
    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
