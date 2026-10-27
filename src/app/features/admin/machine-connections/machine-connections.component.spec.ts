import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MachineConnectionsService } from '../services/machine-connections.service';
import { MachineConnection } from '../models/machine-connection.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { MachineConnectionsComponent } from './machine-connections.component';

const PLC: MachineConnection = {
  id: 6, workCenterId: 2, workCenterName: 'Press 4', name: 'Press 4 PLC', opcUaEndpoint: 'opc.tcp://press4:4840',
  securityPolicy: 'None', authType: 'UserName', status: 'Connected', lastConnectedAt: null, lastError: null,
  pollIntervalMs: 1000, isActive: true, tagCount: 1, credentialsConfigured: true, lastDataPointAt: '2026-10-27T08:30:00Z',
  tags: [
    { id: 1, tagName: 'Barrel temp', opcNodeId: 'ns=2;s=Barrel', dataType: 'Double', unit: 'C', warningThresholdLow: null,
      warningThresholdHigh: 240, alarmThresholdLow: null, alarmThresholdHigh: 260, isActive: true },
    { id: 2, tagName: 'Old', opcNodeId: 'ns=2;s=Old', dataType: 'Int32', unit: null, warningThresholdLow: null,
      warningThresholdHigh: null, alarmThresholdLow: null, alarmThresholdHigh: null, isActive: false },
  ],
};

interface Internals {
  form: FormGroup;
  tags: FormArray<FormGroup>;
  connections(): MachineConnection[];
  workCenterOptions(): { value: unknown; label: string }[];
  openCreate(): void;
  openEdit(row: MachineConnection): void;
  addTag(): void;
  duplicateNodeIds(): boolean;
  save(): void;
  test(row: MachineConnection): void;
  statusClass(row: MachineConnection): string;
}

function setup() {
  const service = {
    list: vi.fn(() => of([PLC])),
    workCenters: vi.fn(() => of([{ id: 2, name: 'Press 4', code: 'P4' }])),
    create: vi.fn(() => of(PLC)),
    update: vi.fn(() => of(PLC)),
    test: vi.fn(() => of({ success: false, errorMessage: 'timeout' })),
  };
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: MachineConnectionsService, useValue: service },
      { provide: SnackbarService, useValue: snackbar },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new MachineConnectionsComponent()) as unknown as Internals;
  return { component, service, snackbar };
}

describe('MachineConnectionsComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists connections and work centers', () => {
    const { component } = setup();

    expect(component.connections()).toEqual([PLC]);
    expect(component.workCenterOptions()).toEqual([{ value: 2, label: 'P4 — Press 4' }]);
    expect(component.statusClass(PLC)).toBe('chip--success');
    expect(component.statusClass({ ...PLC, status: 'Error' })).toBe('chip--error');
  });

  it('creates a connection with its tag map', () => {
    const { component, service } = setup();

    component.openCreate();
    component.form.patchValue({ name: 'Lathe 2', workCenterId: 2, opcUaEndpoint: 'opc.tcp://lathe2:4840', authType: 'Anonymous', credentials: 'ignored' });
    component.addTag();
    component.tags.at(0).patchValue({ tagName: 'Spindle', opcNodeId: ' ns=2;s=Spindle ', unit: 'rpm', alarmThresholdHigh: 8000 });
    component.save();

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Lathe 2', workCenterId: 2, credentials: null,
      tags: [expect.objectContaining({ tagName: 'Spindle', opcNodeId: 'ns=2;s=Spindle', unit: 'rpm', alarmThresholdHigh: 8000 })],
    }));
  });

  it('edits only the active tags and keeps stored credentials when the field is blank', () => {
    const { component, service } = setup();

    component.openEdit(PLC);
    expect(component.tags.length).toBe(1);
    component.save();

    expect(service.update).toHaveBeenCalledWith(6, expect.objectContaining({ credentials: null, authType: 'UserName' }));
  });

  it('refuses two tags on the same node', () => {
    const { component, service } = setup();

    component.openEdit(PLC);
    component.addTag();
    component.tags.at(1).patchValue({ tagName: 'Copy', opcNodeId: 'ns=2;s=Barrel' });

    expect(component.duplicateNodeIds()).toBe(true);
    component.save();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('reports a failed connection test', () => {
    const { component, service, snackbar } = setup();

    component.test(PLC);

    expect(service.test).toHaveBeenCalledWith(6);
    expect(snackbar.error).toHaveBeenCalledWith('machineConnectionsAdmin.testFailed');
  });
});
