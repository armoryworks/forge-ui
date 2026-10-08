import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';

import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { UserPreferencesService } from '../../../../shared/services/user-preferences.service';
import { InventoryClass } from '../../models/inventory-class.type';
import { ProcurementSource } from '../../models/procurement-source.type';
import {
  NEW_PART_FORK_PREF_KEY,
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
  violations(): string[];
  inventoryChoices(): { value: InventoryClass; titleKey: string; descKey: string }[];
  inventoryCards(): { value: InventoryClass; enabled: boolean }[];
  pickProcurement(p: ProcurementSource): void;
  pickInventoryClass(c: InventoryClass): void;
  pickMode(m: 'express' | 'guided'): void;
  continue(): void;
  close(): void;
  itemKindControl: { value: number | null; disabled: boolean; setValue(v: number | null): void };
}

function setup(saved: Partial<NewPartForkResult> | null = null, itemKindIds: number[] = []) {
  const dialogRef = {
    close: vi.fn(),
    updatePosition: vi.fn(),
  } as unknown as MatDialogRef<NewPartForkDialogComponent, NewPartForkResult | undefined>;

  const prefsStub = {
    get: vi.fn((key: string) => (key === NEW_PART_FORK_PREF_KEY ? saved : null)),
    set: vi.fn(),
  };

  const refDataStub = {
    getByGroup: () => of(itemKindIds.map((id, i) => ({ id, label: `Kind ${id}`, isActive: true, sortOrder: i }))),
  } as unknown as ReferenceDataService;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [NewPartForkDialogComponent],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: ReferenceDataService, useValue: refDataStub },
      { provide: UserPreferencesService, useValue: prefsStub },
      provideHttpClient(),
      provideHttpClientTesting(),
      provideNoopAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });

  const fixture = TestBed.createComponent(NewPartForkDialogComponent);
  fixture.detectChanges();
  const component = fixture.componentInstance as unknown as ForkInternals;
  return { fixture, component, dialogRef, prefsStub };
}

describe('NewPartForkDialogComponent (pre-beta — axis-based picker)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('starts with no axis picks', () => {
    const { component } = setup();
    expect(component.procurement()).toBeNull();
    expect(component.inventoryClass()).toBeNull();
    expect(component.modeOverride()).toBeNull();
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

  it('pins itself near the top of the viewport', () => {
    const { dialogRef } = setup();
    expect(dialogRef.updatePosition).toHaveBeenCalledWith({ top: '8vh' });
  });

  it('lays out every inventory class card and enables only the viable ones', () => {
    const { component } = setup();
    expect(component.inventoryCards().map(c => c.value))
      .toEqual(['Raw', 'Component', 'Subassembly', 'FinishedGood', 'Consumable', 'Tool']);
    expect(component.inventoryCards().every(c => !c.enabled)).toBe(true);

    component.pickProcurement('Phantom');
    expect(component.inventoryCards().filter(c => c.enabled).map(c => c.value))
      .toEqual(['Subassembly', 'FinishedGood']);
  });

  it('keeps the item kind disabled until an inventory class is picked', () => {
    const { component, fixture } = setup();
    expect(component.itemKindControl.disabled).toBe(true);
    component.pickProcurement('Buy');
    component.pickInventoryClass('Raw');
    fixture.detectChanges();
    expect(component.itemKindControl.disabled).toBe(false);
  });

  it('shows no violations until Continue is pressed', () => {
    const { component } = setup();
    expect(component.violations()).toEqual([]);
    component.continue();
    expect(component.violations().length).toBe(2);
  });

  it('remembers the last choice and preselects it next time', () => {
    const first = setup();
    first.component.pickProcurement('Make');
    first.component.pickInventoryClass('Component');
    first.component.pickMode('express');
    first.component.continue();
    const saved = first.prefsStub.set.mock.calls[0];
    expect(saved[0]).toBe(NEW_PART_FORK_PREF_KEY);
    expect(saved[1]).toEqual({
      procurementSource: 'Make',
      inventoryClass: 'Component',
      itemKindId: null,
      mode: 'express',
    });

    const { component } = setup({ ...saved[1], itemKindId: 7 }, [7]);
    expect(component.procurement()).toBe('Make');
    expect(component.inventoryClass()).toBe('Component');
    expect(component.itemKindControl.value).toBe(7);
    expect(component.effectiveMode()).toBe('express');
    expect(component.modeOverride()).toBe('express');
  });

  it('restores a remembered mode that matches the recommendation without overriding it', () => {
    const { component } = setup({ procurementSource: 'Make', inventoryClass: 'Component', itemKindId: null, mode: 'guided' });
    expect(component.effectiveMode()).toBe('guided');
    expect(component.modeOverride()).toBeNull();
  });

  it('ignores a remembered choice that is no longer a viable combo', () => {
    const { component } = setup({ procurementSource: 'Phantom', inventoryClass: 'Raw', itemKindId: null, mode: 'express' });
    expect(component.procurement()).toBeNull();
    expect(component.inventoryClass()).toBeNull();
  });

  it('drops a remembered item kind that is no longer offered', () => {
    const { component } = setup({ procurementSource: 'Buy', inventoryClass: 'Raw', itemKindId: 99, mode: 'express' });
    expect(component.inventoryClass()).toBe('Raw');
    expect(component.itemKindControl.value).toBeNull();
  });

  it('close() emits undefined', () => {
    const { component, dialogRef } = setup();
    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
