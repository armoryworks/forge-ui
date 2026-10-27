import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ProjectListComponent } from './project-list.component';
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project.model';

interface ListApi {
  projects(): Project[];
  statusFilter: { setValue(v: string | null): void };
  load(): void;
  open(row: unknown): void;
  openCreate(): void;
}

describe('ProjectListComponent', () => {
  it('lists projects, filters by status, and opens a new project after creating it', () => {
    const list = vi.fn(() => of({ data: [{ id: 2, projectNumber: 'PRJ-0002' }], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 }));
    const navigate = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ProjectService, useValue: { list } },
        { provide: Router, useValue: { navigate } },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of({ id: 9 }) })) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new ProjectListComponent()) as unknown as ListApi;

    expect(page.projects()).toHaveLength(1);
    page.statusFilter.setValue('Active');
    page.load();
    expect(list).toHaveBeenLastCalledWith({ status: 'Active' });

    page.open(page.projects()[0]);
    expect(navigate).toHaveBeenCalledWith(['/projects', 2]);

    page.openCreate();
    expect(navigate).toHaveBeenCalledWith(['/projects', 9]);
  });
});
