import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { FmeaListComponent } from './fmea-list.component';
import { FmeaService } from '../../services/fmea.service';
import { Fmea } from '../../models/fmea.model';
import { FmeaItem } from '../../models/fmea-item.model';
import { AuthService } from '../../../../../shared/services/auth.service';

interface ListApi {
  canAuthor: boolean;
  fmeas(): Fmea[];
  highRpnItems(): FmeaItem[];
  typeFilter: { setValue(v: string | null): void };
  load(): void;
  switchView(view: 'analyses' | 'high-rpn'): void;
  open(row: unknown): void;
  openItem(row: unknown): void;
  openCreate(): void;
}

const FMEA = { id: 4, fmeaNumber: 'FMEA-004', name: 'Weld cell', type: 'Process', status: 'Active', maxRpn: 280, highRpnCount: 1, items: [] } as unknown as Fmea;

describe('FmeaListComponent', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let navigate: ReturnType<typeof vi.fn>;
  let roles: string[];

  function setup(): ListApi {
    service = {
      list: vi.fn(() => of([FMEA])),
      highRpn: vi.fn(() => of([{ id: 9, fmeaId: 4, rpn: 280 } as unknown as FmeaItem])),
    };
    navigate = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FmeaService, useValue: service },
        { provide: Router, useValue: { navigate } },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of({ id: 12 }) })) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new FmeaListComponent()) as unknown as ListApi;
  }

  beforeEach(() => { roles = ['Engineer']; });

  it('loads the analyses and filters them by type', () => {
    const list = setup();
    expect(list.fmeas()).toEqual([FMEA]);

    list.typeFilter.setValue('Design');
    list.load();

    expect(service['list']).toHaveBeenLastCalledWith({ type: 'Design', status: undefined });
  });

  it('shows the high-RPN items at or above the action threshold and opens their FMEA', () => {
    const list = setup();

    list.switchView('high-rpn');
    expect(service['highRpn']).toHaveBeenCalledWith(199);
    list.openItem(list.highRpnItems()[0]);

    expect(navigate).toHaveBeenCalledWith(['/quality/fmea', 4]);
  });

  it('opens the editor of a new FMEA after it is created', () => {
    const list = setup();

    list.openCreate();

    expect(navigate).toHaveBeenCalledWith(['/quality/fmea', 12]);
  });

  it('does not offer New FMEA to a role that cannot author', () => {
    roles = ['ProductionWorker'];
    expect(setup().canAuthor).toBe(false);
  });
});
