import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { WorkCenterDialogComponent } from './work-center-dialog.component';
import { AssetsService } from '../../../assets/services/assets.service';
import { SchedulingService } from '../../services/scheduling.service';
import { WorkCenter } from '../../models/scheduling.model';

interface DialogApi {
  form: FormGroup;
  teamOptions: () => { value: unknown; label: string }[];
  save(): void;
  saved: { subscribe(fn: (value: Partial<WorkCenter>) => void): void };
  dialogRef: { clearDraft(): void };
  ngOnInit(): void;
}

const workCenter: WorkCenter = {
  id: 9,
  name: 'Deburr',
  code: 'WC-DB',
  description: null,
  dailyCapacityHours: 8,
  efficiencyPercent: 100,
  numberOfMachines: 1,
  laborCostPerHour: 0,
  burdenRatePerHour: 0,
  isActive: true,
  assetId: null,
  assetName: null,
  companyLocationId: 2,
  locationName: null,
  sortOrder: 0,
  teamId: 5,
  teamName: 'Finishing',
};

describe('WorkCenterDialogComponent', () => {
  let getTeams: ReturnType<typeof vi.fn>;

  function create(existing: WorkCenter | null): { api: DialogApi; emitted: Partial<WorkCenter>[] } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AssetsService, useValue: { getAssets: () => of([]) } },
        { provide: SchedulingService, useValue: { getTeams } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(WorkCenterDialogComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(WorkCenterDialogComponent);
    fixture.componentRef.setInput('workCenter', existing);
    const api = fixture.componentInstance as unknown as DialogApi;
    api.dialogRef = { clearDraft: vi.fn() };
    api.ngOnInit();
    const emitted: Partial<WorkCenter>[] = [];
    api.saved.subscribe(value => emitted.push(value));
    return { api, emitted };
  }

  beforeEach(() => {
    getTeams = vi.fn(() => of([
      { id: 3, name: 'Machining', color: null },
      { id: 5, name: 'Finishing', color: null },
    ]));
  });

  it('offers no team followed by every team', () => {
    const { api } = create(null);

    expect(api.teamOptions()).toEqual([
      { value: null, label: 'workCenterDialog.noTeam' },
      { value: 3, label: 'Machining' },
      { value: 5, label: 'Finishing' },
    ]);
  });

  it('hides the team picker when the team list cannot be read', () => {
    getTeams.mockReturnValue(throwError(() => new Error('capability off')));
    const { api } = create(null);

    expect(api.teamOptions()).toEqual([]);
  });

  it('saves the chosen owning team on a new work center', () => {
    const { api, emitted } = create(null);
    api.form.patchValue({ code: 'WC-MILL', name: 'Mill', teamId: 3 });

    api.save();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].teamId).toBe(3);
  });

  it('keeps the owning team and the active flag when editing', () => {
    const { api, emitted } = create(workCenter);

    api.save();

    expect(emitted[0].teamId).toBe(5);
    expect(emitted[0].isActive).toBe(true);
    expect(emitted[0].companyLocationId).toBe(2);
  });

  it('saves a deactivated work center as inactive', () => {
    const { api, emitted } = create(workCenter);
    api.form.patchValue({ isActive: false, teamId: null });

    api.save();

    expect(emitted[0].isActive).toBe(false);
    expect(emitted[0].teamId).toBeNull();
  });
});
