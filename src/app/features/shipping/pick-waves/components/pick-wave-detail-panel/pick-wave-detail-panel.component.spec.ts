import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../../testing/signal-input-harness';
import { PickWaveService } from '../../services/pick-wave.service';
import { PickWave } from '../../models/pick-wave.model';
import { PickLine } from '../../models/pick-line.model';
import { FileDownloadService } from '../../../../../shared/services/file-download.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { PickWaveDetailPanelComponent } from './pick-wave-detail-panel.component';

const line = (id: number, status: PickLine['status']): PickLine => ({
  id, waveId: 4, waveNumber: 'WAVE-0004', shipmentLineId: id, shipmentNumber: 'SH-1', partId: 1, partNumber: 'P-1',
  partDescription: 'Bracket', fromLocationName: 'Bin 3', binPath: 'Aisle 1 / Bin 3', lotNumber: 'LOT-7',
  requestedQuantity: 2, pickedQuantity: 0, status, sortOrder: id, pickedByUserId: null, pickedAt: null, shortNotes: null,
});
const wave = (status: PickWave['status'], lines: PickLine[]): PickWave => ({
  id: 4, waveNumber: 'WAVE-0004', status, strategy: 'Zone', assignedToId: null, assignedToName: null,
  totalLines: lines.length, pickedLines: 0, releasedAt: null, startedAt: null, completedAt: null, notes: null,
  createdAt: '2026-10-26T10:00:00Z', lines,
});

interface Internals {
  wave: Signal<PickWave | null>;
  canRelease: Signal<boolean>;
  canPick: Signal<boolean>;
  confirming: Signal<PickLine | null>;
  release(): void;
  complete(): void;
  print(): void;
  openConfirm(l: PickLine): void;
  onConfirmed(): void;
}

describe('PickWaveDetailPanelComponent', () => {
  const getWave = vi.fn();
  const release = vi.fn(() => of(undefined));
  const complete = vi.fn(() => of(undefined));
  const open = vi.fn(() => ({ afterClosed: () => of(true) }));
  const fileOpen = vi.fn();

  function create(): { c: Internals; changed: ReturnType<typeof vi.fn> } {
    const component = TestBed.runInInjectionContext(() => new PickWaveDetailPanelComponent());
    mockSignalInputs(component, { waveId: 4 });
    const changed = vi.fn();
    component.changed.subscribe(changed);
    TestBed.tick();
    return { c: component as unknown as Internals, changed };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    getWave.mockReset();
    [release, complete, open, fileOpen].forEach(f => f.mockClear());
    TestBed.configureTestingModule({
      providers: [
        { provide: PickWaveService, useValue: { getWave, release, complete, pdfUrl: (id: number) => `/pick-waves/${id}/pdf` } },
        { provide: FileDownloadService, useValue: { open: fileOpen } },
        { provide: MatDialog, useValue: { open } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  it('loads the wave and lets a draft be released', () => {
    getWave.mockReturnValue(of(wave('Draft', [line(1, 'Pending')])));
    const { c, changed } = create();
    expect(getWave).toHaveBeenCalledWith(4);
    expect(c.canRelease()).toBe(true);
    expect(c.canPick()).toBe(false);

    c.release();

    expect(release).toHaveBeenCalledWith(4);
    expect(changed).toHaveBeenCalled();
  });

  it('opens the confirm dialog for a pending line of a released wave and reloads after', () => {
    getWave.mockReturnValue(of(wave('Released', [line(1, 'Pending')])));
    const { c } = create();
    expect(c.canPick()).toBe(true);

    c.openConfirm(c.wave()!.lines[0]);
    expect(c.confirming()?.id).toBe(1);
    c.onConfirmed();

    expect(c.confirming()).toBeNull();
    expect(getWave).toHaveBeenCalledTimes(2);
  });

  it('asks before completing a wave with lines still to pick', () => {
    getWave.mockReturnValue(of(wave('InProgress', [line(1, 'Picked'), line(2, 'Pending')])));
    const { c } = create();
    c.complete();
    expect(open).toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith(4);
  });

  it('completes without asking when every line is picked', () => {
    getWave.mockReturnValue(of(wave('InProgress', [line(1, 'Picked')])));
    const { c } = create();
    c.complete();
    expect(open).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith(4);
  });

  it('prints the pick list PDF', () => {
    getWave.mockReturnValue(of(wave('Released', [line(1, 'Pending')])));
    create().c.print();
    expect(fileOpen).toHaveBeenCalledWith('/pick-waves/4/pdf', 'pick-list-WAVE-0004.pdf');
  });
});
