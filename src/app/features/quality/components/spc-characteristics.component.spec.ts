import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SpcCharacteristicsComponent } from './spc-characteristics.component';
import { SpcService } from '../services/spc.service';
import { SpcCharacteristic } from '../models/spc.model';
import { PartsService } from '../../parts/services/parts.service';
import { Operation } from '../../parts/models/operation.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { SelectOption } from '../../../shared/components/select/select.component';

interface CharacteristicsView {
  form: FormGroup;
  operationOptions: Signal<SelectOption[]>;
  editingPartNumber: Signal<string>;
  openCreate(): void;
  openEdit(char: SpcCharacteristic): void;
}

const op = (id: number, stepNumber: number, title: string) => ({ id, stepNumber, title }) as Operation;

describe('SpcCharacteristicsComponent part and operation pickers', () => {
  let getOperations: ReturnType<typeof vi.fn>;
  let view: CharacteristicsView;

  beforeEach(() => {
    TestBed.resetTestingModule();
    getOperations = vi.fn((partId: number) => of(partId === 12 ? [op(5, 20, 'Deburr'), op(4, 10, 'Mill')] : []));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: SpcService, useValue: { getCharacteristics: vi.fn(() => of([])) } },
        { provide: PartsService, useValue: { getOperations } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    view = TestBed.runInInjectionContext(() => new SpcCharacteristicsComponent()) as unknown as CharacteristicsView;
    view.openCreate();
  });

  it('offers the picked part\'s routing operations in step order', () => {
    view.form.patchValue({ partId: 12 });

    expect(getOperations).toHaveBeenCalledWith(12);
    expect(view.operationOptions()).toEqual([
      { value: null, label: 'spc.characteristics.noOperation' },
      { value: 4, label: '10 · Mill' },
      { value: 5, label: '20 · Deburr' },
    ]);
  });

  it('offers no operation select when the part has no routing', () => {
    view.form.patchValue({ partId: 99 });

    expect(view.operationOptions()).toEqual([]);
  });

  it('clears the operation when the part changes', () => {
    view.form.patchValue({ partId: 12 });
    view.form.patchValue({ operationId: 4 });

    view.form.patchValue({ partId: 99 });

    expect(view.form.value.operationId).toBeNull();
  });

  it('keeps the saved operation when editing and loads that part\'s routing', () => {
    view.openEdit({
      id: 1, partId: 12, partNumber: 'BRK-100', operationId: 5, name: 'Bore', measurementType: 'Variable',
    } as SpcCharacteristic);

    expect(view.form.value.partId).toBe(12);
    expect(view.editingPartNumber()).toBe('BRK-100');
    expect(view.form.value.operationId).toBe(5);
    expect(getOperations).toHaveBeenLastCalledWith(12);
    expect(view.operationOptions().map(o => o.value)).toEqual([null, 4, 5]);
  });
});
