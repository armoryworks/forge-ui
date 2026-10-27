import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CloudStorageService } from '../services/cloud-storage.service';
import { CloudStorageProvider, CloudStorageProviderType, FolderMapEntry } from '../models/cloud-storage.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { CloudStorageComponent } from './cloud-storage.component';

const DRIVE: CloudStorageProvider = {
  id: 3, providerCode: 'gdrive', mode: 'ServiceAccount', isActive: true, rootFolderId: 'root-1', serviceAccountId: 'svc@example.test',
  credentialsConfigured: true, tokenExpiresAt: null, lastConnectedAt: null, lastError: null, linkedRecordCount: 0, createdAt: '2026-10-01T00:00:00Z',
};

const TYPES: CloudStorageProviderType[] = [
  { code: 'gdrive', capabilityCode: 'CAP-EXT-CLOUD-STORAGE-GDRIVE', capabilityEnabled: true, registered: true },
  { code: 'dropbox', capabilityCode: 'CAP-EXT-CLOUD-STORAGE-DROPBOX', capabilityEnabled: false, registered: false },
];

const MAP: FolderMapEntry[] = [{ entityType: 'Customer', pathTemplate: 'Clients/{Customer}', subfolderNames: ['Quotes'], autoCreateOnEntityCreate: true }];

interface Internals {
  form: FormGroup;
  folderMap: FormArray<FormGroup>;
  providers(): CloudStorageProvider[];
  providerOptions(): { value: unknown }[];
  openCreate(): void;
  openEdit(row: CloudStorageProvider): void;
  canSave(): boolean;
  save(): void;
  test(row: CloudStorageProvider): void;
  addFolderMapRow(): void;
  duplicateEntityTypes(): boolean;
  folderMapPayload(): FolderMapEntry[];
  saveFolderMap(): void;
}

function setup() {
  const service = {
    providers: vi.fn(() => of([DRIVE])),
    providerTypes: vi.fn(() => of(TYPES)),
    folderMap: vi.fn(() => of(MAP)),
    create: vi.fn(() => of(DRIVE)),
    update: vi.fn(() => of(DRIVE)),
    delete: vi.fn(() => of(undefined)),
    test: vi.fn(() => of({ success: true, message: 'ok', latencyMs: 12 })),
    saveFolderMap: vi.fn((entries: FolderMapEntry[]) => of(entries)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: CloudStorageService, useValue: service },
      { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new CloudStorageComponent()) as unknown as Internals;
  return { component, service };
}

describe('CloudStorageComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('offers only providers whose capability is on', () => {
    const { component } = setup();

    expect(component.providers()).toEqual([DRIVE]);
    expect(component.providerOptions().map(o => o.value)).toEqual(['gdrive']);
  });

  it('requires both tokens for a new service-account provider', () => {
    const { component, service } = setup();

    component.openCreate();
    component.form.patchValue({ mode: 'ServiceAccount', accessToken: 'a' });
    expect(component.canSave()).toBe(false);
    component.form.patchValue({ refreshToken: 'r', rootFolderId: ' root-9 ' });
    component.save();

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
      providerCode: 'gdrive', mode: 'ServiceAccount', accessToken: 'a', refreshToken: 'r', rootFolderId: 'root-9',
    }));
  });

  it('edits without re-entering stored tokens', () => {
    const { component, service } = setup();

    component.openEdit(DRIVE);
    expect(component.canSave()).toBe(true);
    component.save();

    expect(service.update).toHaveBeenCalledWith(3, expect.objectContaining({ accessToken: null, refreshToken: null }));
  });

  it('tests a provider connection', () => {
    const { component, service } = setup();

    component.test(DRIVE);

    expect(service.test).toHaveBeenCalledWith(3);
  });

  it('edits the folder map and saves it in the API shape', () => {
    const { component, service } = setup();

    expect(component.folderMap.length).toBe(1);
    component.addFolderMapRow();
    component.folderMap.at(1).patchValue({ pathTemplate: 'Clients/{Customer}/{Job}', subfolders: 'CAD, Inspection,  ' });
    expect(component.duplicateEntityTypes()).toBe(false);
    component.saveFolderMap();

    expect(service.saveFolderMap).toHaveBeenCalledWith([
      MAP[0],
      { entityType: 'Job', pathTemplate: 'Clients/{Customer}/{Job}', subfolderNames: ['CAD', 'Inspection'], autoCreateOnEntityCreate: true },
    ]);
  });

  it('blocks saving two rules for one record type', () => {
    const { component, service } = setup();

    component.addFolderMapRow();
    component.folderMap.at(1).patchValue({ entityType: 'Customer', pathTemplate: 'X' });
    component.saveFolderMap();

    expect(component.duplicateEntityTypes()).toBe(true);
    expect(service.saveFolderMap).not.toHaveBeenCalled();
  });
});
