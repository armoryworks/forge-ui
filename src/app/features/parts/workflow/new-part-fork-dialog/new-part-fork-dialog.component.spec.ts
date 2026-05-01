import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';

import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { InventoryClass } from '../../models/inventory-class.type';
import { ProcurementSource } from '../../models/procurement-source.type';
import {
  NewPartForkDialogComponent,
  NewPartForkResult,
} from './new-part-fork-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface ForkInternals {
  procurement(): ProcurementSource | null;
  inventoryClass(): InventoryClass | null;
  modeOverride(): 'express' | 'guided' | null;
  recommendedMode(): 'express' | 'guided';
  effectiveMode(): 'express' | 'guided';
  canContinue(): boolean;
  inventoryChoices(): { value: InventoryClass; titleKey: string; descKey: string }[];
  pickProcurement(p: ProcurementSource): void;
  pickInventoryClass(c: InventoryClass): void;
  pickMode(m: 'express' | 'guided'): void;
  continue(): void;
  close(): void;
  itemKindControl: { setValue(v: number | null): void };
}

function setup() {
  const dialogRef = {
    close: vi.fn(),
  } as unknown as MatDialogRef<NewPartForkDialogComponent, NewPartForkResult | undefined>;

  const refDataStub = {
    // Pre-beta: the dialog calls getByGroup('part.item_kind'); a no-op
    // observable is enough for these tests.
    getByGroup: () => of([]),
  } as unknown as ReferenceDataService;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [NewPartForkDialogComponent],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: ReferenceDataService, useValue: refDataStub },
      provideHttpClient(),
      provideHttpClientTesting(),
      provideNoopAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });

  const fixture = TestBed.createComponent(NewPartForkDialogComponent);
  fixture.detectChanges();
  const component = fixture.componentInstance as unknown as ForkInternals;
  return { fixture, component, dialogRef };
}

describe('NewPartForkDialogComponent (pre-beta — axis-based picker)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('starts with no axis picks and Continue disabled', () => {
    const { component } = setup();
    expect(component.procurement()).toBeNull();
    expect(component.inventoryClass()).toBeNull();
    expect(component.modeOverride()).toBeNull();
    expect(component.canContinue()).toBe(false);
  });

  it('Step 1 (Buy) reveals 6 inventory class options (B1-B6 combos)', () => {
    const { component } = setup();
    component.pickProcurement('Buy');
    const choices = component.inventoryChoices().map(c => c.value);
    expect(choices).toEqual(['Raw', 'Component', 'Subassembly', 'FinishedGood', 'Consumable', 'Tool']);
  });

  it('Step 1 (Make) reveals 4 inventory class options (M1-M4 combos)', () => {
    const { component } = setup();
    component.pickProcurement('Make');
    const choices = component.inventoryChoices().map(c => c.value);
    expect(choices).toEqual(['Component', 'Subassembly', 'FinishedGood', 'Tool']);
  });

  it('Step 1 (Subcontract) reveals 2 inventory class options (S1, S2 combos)', () => {
    const { component } = setup();
    component.pickProcurement('Subcontract');
    const choices = component.inventoryChoices().map(c => c.value);
    expect(choices).toEqual(['Component', 'Subassembly']);
  });

  it('Step 1 (Phantom) reveals 2 inventory class options (P1, P3 combos) — no Raw / Component / Consumable', () => {
    const { component } = setup();
    component.pickProcurement('Phantom');
    const choices = component.inventoryChoices().map(c => c.value);
    expect(choices).toEqual(['Subassembly', 'FinishedGood']);
  });

  it('switching procurement clears the prior inventory pick', () => {
    const { component } = setup();
    component.pickProcurement('Buy');
    component.pickInventoryClass('Raw');
    expect(component.inventoryClass()).toBe('Raw');
    component.pickProcurement('Make');
    expect(component.inventoryClass()).toBeNull();
  });

  it('Buy + Raw recommends express (audit Section 5.B1)', () => {
    const { component } = setup();
    component.pickProcurement('Buy');
    component.pickInventoryClass('Raw');
    expect(component.recommendedMode()).toBe('express');
    expect(component.effectiveMode()).toBe('express');
    expect(component.canContinue()).toBe(true);
  });

  it('Make + Subassembly recommends guided (audit Section 5.M2)', () => {
    const { component } = setup();
    component.pickProcurement('Make');
    component.pickInventoryClass('Subassembly');
    expect(component.recommendedMode()).toBe('guided');
    expect(component.effectiveMode()).toBe('guided');
  });

  it('Subcontract + Component recommends guided (audit Section 5.S1)', () => {
    const { component } = setup();
    component.pickProcurement('Subcontract');
    component.pickInventoryClass('Component');
    expect(component.recommendedMode()).toBe('guided');
  });

  it('Phantom + FinishedGood recommends express (audit Section 5.P3)', () => {
    const { component } = setup();
    component.pickProcurement('Phantom');
    component.pickInventoryClass('FinishedGood');
    expect(component.recommendedMode()).toBe('express');
  });

  it('user override of Step 4 wins over the recommended default', () => {
    const { component } = setup();
    component.pickProcurement('Buy');
    component.pickInventoryClass('Raw');
    expect(component.effectiveMode()).toBe('express');
    component.pickMode('guided');
    expect(component.modeOverride()).toBe('guided');
    expect(component.effectiveMode()).toBe('guided');
  });

  it('continue() emits the four-axis result with itemKindId null when skipped', () => {
    const { component, dialogRef } = setup();
    component.pickProcurement('Buy');
    component.pickInventoryClass('Raw');
    component.continue();
    expect(dialogRef.close).toHaveBeenCalledWith({
      procurementSource: 'Buy',
      inventoryClass: 'Raw',
      itemKindId: null,
      mode: 'express',
    });
  });

  it('continue() emits the explicit itemKindId when the user picked one', () => {
    const { component, dialogRef } = setup();
    component.pickProcurement('Make');
    component.pickInventoryClass('Subassembly');
    component.itemKindControl.setValue(42);
    component.continue();
    expect(dialogRef.close).toHaveBeenCalledWith({
      procurementSource: 'Make',
      inventoryClass: 'Subassembly',
      itemKindId: 42,
      mode: 'guided',
    });
  });

  it('continue() is a no-op until both axes are picked', () => {
    const { component, dialogRef } = setup();
    component.continue();
    expect(dialogRef.close).not.toHaveBeenCalled();

    component.pickProcurement('Buy');
    component.continue();
    expect(dialogRef.close).not.toHaveBeenCalled();

    component.pickInventoryClass('Component');
    component.continue();
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('close() emits undefined', () => {
    const { component, dialogRef } = setup();
    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
