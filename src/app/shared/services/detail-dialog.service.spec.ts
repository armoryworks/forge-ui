import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';

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

  it('open should move focus into the dialog at once and restore it on close', () => {
    vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

    service.open('part', 7, TestDialogComponent, { partId: 7 });

    expect(dialogOpenSpy).toHaveBeenCalledWith(
      TestDialogComponent,
      expect.objectContaining({
        enterAnimationDuration: '150ms',
        autoFocus: 'dialog',
        delayFocusTrap: false,
        restoreFocus: true,
      }),
    );
  });

  it('open should restore focus to the element that opened the first dialog', () => {
    vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));
    const origin = document.createElement('button');
    document.body.appendChild(origin);
    origin.focus();

    service.open('part', 7, TestDialogComponent, { partId: 7 });

    expect(dialogOpenSpy.mock.calls[0][1].restoreFocus).toBe(origin);
    origin.remove();
  });

  describe('replacing an open detail dialog', () => {
    let closed$: Subject<void>[];
    let refs: { close: ReturnType<typeof vi.fn>; afterClosed: () => Subject<void> }[];

    beforeEach(() => {
      closed$ = [];
      refs = [];
      dialogOpenSpy.mockImplementation(() => {
        const after = new Subject<void>();
        const ref = {
          close: vi.fn(() => after.next()),
          afterClosed: () => after,
        };
        closed$.push(after);
        refs.push(ref);
        return ref;
      });
    });

    it('closes the current dialog before opening the next one', () => {
      vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

      service.open('job', 42, TestDialogComponent, { jobId: 42 });
      service.open('part', 7, TestDialogComponent, { partId: 7 });

      expect(refs[0].close).toHaveBeenCalledTimes(1);
      expect(refs[1].close).not.toHaveBeenCalled();
    });

    it('keeps the new detail param when the replaced dialog finishes closing', () => {
      vi.spyOn(router, 'url', 'get').mockReturnValue('/parts?detail=part:7');
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

      service.open('job', 42, TestDialogComponent, { jobId: 42 });
      navigateSpy.mockClear();
      service.open('part', 7, TestDialogComponent, { partId: 7 });

      const urls = navigateSpy.mock.calls.map(call => call[0].toString());
      expect(urls).toEqual(['/parts?detail=part:7']);
    });

    it('keeps the original focus origin across the chain', () => {
      vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));
      const origin = document.createElement('button');
      document.body.appendChild(origin);
      origin.focus();

      service.open('job', 42, TestDialogComponent, { jobId: 42 });
      const link = document.createElement('a');
      link.tabIndex = 0;
      document.body.appendChild(link);
      link.focus();
      service.open('part', 7, TestDialogComponent, { partId: 7 });

      expect(dialogOpenSpy.mock.calls[1][1].restoreFocus).toBe(origin);
      origin.remove();
      link.remove();
    });

    it('clears detail and the panel tab when the last dialog closes', () => {
      const urlSpy = vi.spyOn(router, 'url', 'get').mockReturnValue('/parts');
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

      service.open('part', 7, TestDialogComponent, { partId: 7 });
      urlSpy.mockReturnValue('/parts?detail=part:7&tab=bom&view=table');
      navigateSpy.mockClear();
      closed$[0].next();

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy.mock.calls[0][0].toString()).toBe('/parts?view=table');
    });

    it('keeps a page-level tab that was there before the dialog opened', () => {
      const urlSpy = vi.spyOn(router, 'url', 'get').mockReturnValue('/admin?tab=training');
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

      service.open('training', 3, TestDialogComponent, {});
      urlSpy.mockReturnValue('/admin?tab=training&detail=training:3');
      navigateSpy.mockClear();
      closed$[0].next();

      expect(navigateSpy.mock.calls[0][0].toString()).toBe('/admin?tab=training');
    });
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
