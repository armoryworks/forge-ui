import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { FmeaEditorComponent } from './fmea-editor.component';
import { FmeaService } from '../../services/fmea.service';
import { Fmea } from '../../models/fmea.model';
import { FmeaItem } from '../../models/fmea-item.model';
import { AuthService } from '../../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

interface EditorApi {
  fmea(): Fmea | null;
  openActions(): number;
  canLinkCapa(): boolean;
  columns(): { field: string }[];
  statusControl: { setValue(v: string): void };
  changeStatus(): void;
  recordAction(item: FmeaItem): void;
  deleteItem(item: FmeaItem): void;
}

const ITEMS = [
  { id: 1, itemNumber: 1, failureMode: 'Porosity', rpn: 210, actionTaken: null },
  { id: 2, itemNumber: 2, failureMode: 'Spatter', rpn: 12, actionTaken: null },
  { id: 3, itemNumber: 3, failureMode: 'Crack', rpn: 300, actionTaken: 'Pre-heat' },
] as unknown as FmeaItem[];

describe('FmeaEditorComponent', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let roles: string[];
  let capaOn: boolean;

  function setup(): EditorApi {
    service = {
      get: vi.fn(() => of({ id: 4, fmeaNumber: 'FMEA-004', name: 'Weld', type: 'Process', status: 'Draft', items: ITEMS, maxRpn: 300, highRpnCount: 2 })),
      update: vi.fn(() => of({ status: 'Active' })),
      deleteItem: vi.fn(() => of(undefined)),
    };
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(true) }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FmeaService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '4' }) } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-QC-CAPA' && capaOn } },
      ],
    });
    return TestBed.runInInjectionContext(() => new FmeaEditorComponent()) as unknown as EditorApi;
  }

  beforeEach(() => {
    roles = ['Engineer'];
    capaOn = true;
  });

  it('loads the FMEA and counts the high-RPN items still waiting for an action', () => {
    const editor = setup();

    expect(service['get']).toHaveBeenCalledWith(4);
    expect(editor.fmea()?.fmeaNumber).toBe('FMEA-004');
    expect(editor.openActions()).toBe(1);
  });

  it('saves a status change', () => {
    const editor = setup();

    editor.statusControl.setValue('Active');
    editor.changeStatus();

    expect(service['update']).toHaveBeenCalledWith(4, { status: 'Active' });
    expect(editor.fmea()?.status).toBe('Active');
  });

  it('reloads after recording an action', () => {
    const editor = setup();

    editor.recordAction(ITEMS[0]);

    expect(dialogOpen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: { fmeaId: 4, item: ITEMS[0] } }));
    expect(service['get']).toHaveBeenCalledTimes(2);
  });

  it('deletes a failure mode once confirmed', () => {
    const editor = setup();

    editor.deleteItem(ITEMS[1]);

    expect(service['deleteItem']).toHaveBeenCalledWith(4, 2);
  });

  it('offers CAPA links only when CAPA is on, and no edit column to read-only roles', () => {
    capaOn = false;
    expect(setup().canLinkCapa()).toBe(false);

    roles = ['PM'];
    capaOn = true;
    const editor = setup();
    expect(editor.canLinkCapa()).toBe(false);
    expect(editor.columns().some(c => c.field === 'actions')).toBe(false);
  });
});
