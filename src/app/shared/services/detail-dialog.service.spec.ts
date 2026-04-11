import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { DetailDialogService } from './detail-dialog.service';

@Component({ selector: 'app-test-dialog', standalone: true, template: '<p>Test</p>' })
class TestDialogComponent {}

describe('DetailDialogService', () => {
  let service: DetailDialogService;
  let dialogOpenSpy: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(() => {
    const mockDialogRef = {
      afterClosed: () => of(undefined),
    } as unknown as MatDialogRef<TestDialogComponent>;

    dialogOpenSpy = vi.fn().mockReturnValue(mockDialogRef);

    TestBed.configureTestingModule({
      imports: [MatDialogModule],
      providers: [
        DetailDialogService,
        provideRouter([]),
        { provide: MatDialog, useValue: { open: dialogOpenSpy } },
      ],
    });

    service = TestBed.inject(DetailDialogService);
    router = TestBed.inject(Router);
  });

  // ── open ──

  it('open should open MatDialog with correct config', () => {
    vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

    service.open('job', 42, TestDialogComponent, { jobId: 42 });

    expect(dialogOpenSpy).toHaveBeenCalledWith(
      TestDialogComponent,
      expect.objectContaining({
        width: '1400px',
        maxWidth: '95vw',
        panelClass: 'detail-dialog-panel',
        data: { jobId: 42 },
      }),
    );
  });

  it('open should update URL with detail query param', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

    service.open('part', 7, TestDialogComponent, { partId: 7 });

    expect(navigateSpy).toHaveBeenCalled();
    const urlTree = navigateSpy.mock.calls[0][0];
    expect(urlTree.toString()).toContain('detail=part');
  });

  // ── getDetailFromUrl ──

  it('getDetailFromUrl should parse entityType and entityId from URL', () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/kanban?detail=job:1055');

    const detail = service.getDetailFromUrl();

    expect(detail).toEqual({ entityType: 'job', entityId: 1055 });
  });

  it('getDetailFromUrl should return null when no detail param', () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/kanban');

    const detail = service.getDetailFromUrl();

    expect(detail).toBeNull();
  });

  it('getDetailFromUrl should return null for invalid format', () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/kanban?detail=invalid');

    const detail = service.getDetailFromUrl();

    expect(detail).toBeNull();
  });

  it('getDetailFromUrl should return null for non-numeric id', () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/kanban?detail=job:abc');

    const detail = service.getDetailFromUrl();

    expect(detail).toBeNull();
  });
});
