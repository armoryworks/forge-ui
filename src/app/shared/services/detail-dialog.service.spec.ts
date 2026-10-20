import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';

import { DetailDialogService } from './detail-dialog.service';
import { DetailNotFoundDialogComponent } from '../components/detail-not-found-dialog/detail-not-found-dialog.component';

@Component({ selector: 'app-test-dialog', standalone: true, template: '<p>Test</p>' })
class TestDialogComponent {}

describe('DetailDialogService', () => {
  let service: DetailDialogService;
  let dialogOpenSpy: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(() => {
    const mockDialogRef = {
      afterClosed: () => of(undefined),
      keydownEvents: () => new Subject<KeyboardEvent>(),
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
          keydownEvents: () => new Subject<KeyboardEvent>(),
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

  describe('Escape', () => {
    let keydown$: Subject<KeyboardEvent>;
    let ref: { id: string; close: ReturnType<typeof vi.fn>; afterClosed: () => Subject<void>; keydownEvents: () => Subject<KeyboardEvent>; componentInstance: unknown };
    let container: HTMLElement;
    let panels: HTMLElement[];

    beforeEach(() => {
      vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));
      keydown$ = new Subject<KeyboardEvent>();
      ref = {
        id: 'detail-dialog-1',
        close: vi.fn(),
        afterClosed: () => new Subject<void>(),
        keydownEvents: () => keydown$,
        componentInstance: null,
      };
      dialogOpenSpy.mockReturnValue(ref);
      container = document.createElement('div');
      container.id = ref.id;
      document.body.appendChild(container);
      panels = [];
    });

    afterEach(() => {
      container.remove();
      panels.forEach(panel => panel.remove());
    });

    function pressEscape(init: KeyboardEventInit = {}): KeyboardEvent {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...init });
      document.dispatchEvent(event);
      keydown$.next(event);
      return event;
    }

    it('closes through the dialog component\'s own close()', () => {
      const close = vi.fn();
      ref.componentInstance = { close };
      service.open('vendor', 1, TestDialogComponent, {});

      pressEscape();

      expect(close).toHaveBeenCalledTimes(1);
      expect(ref.close).not.toHaveBeenCalled();
    });

    it('closes the ref when the component has no close()', () => {
      service.open('vendor', 1, TestDialogComponent, {});

      pressEscape();

      expect(ref.close).toHaveBeenCalledTimes(1);
    });

    it('ignores other keys and handled Escape presses', () => {
      service.open('vendor', 1, TestDialogComponent, {});

      keydown$.next(new KeyboardEvent('keydown', { key: 'Enter' }));
      const handled = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      handled.preventDefault();
      keydown$.next(handled);

      expect(ref.close).not.toHaveBeenCalled();
    });

    it('leaves the dialog open while an inline app-dialog inside it owns Escape', () => {
      container.appendChild(document.createElement('app-dialog'));
      service.open('po', 1, TestDialogComponent, {});

      pressEscape();

      expect(ref.close).not.toHaveBeenCalled();
    });

    it('leaves the dialog open when Escape closes an open select panel', () => {
      const panel = document.createElement('div');
      panel.className = 'mat-mdc-select-panel';
      document.body.appendChild(panel);
      panels.push(panel);
      service.open('vendor', 1, TestDialogComponent, {});

      pressEscape();

      expect(ref.close).not.toHaveBeenCalled();
    });

    it('reports the open detail dialog as current', () => {
      const opened = service.open('vendor', 1, TestDialogComponent, {});

      expect(service.isCurrent(opened as unknown as MatDialogRef<unknown, unknown>)).toBe(true);
      expect(service.isCurrent(null)).toBe(false);
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
    dialogOpenSpy.mockReturnValue({ afterClosed: () => new Subject<void>() });

    const detail = service.getDetailFromUrl();

    expect(detail).toBeNull();
  });

  it('getDetailFromUrl should return null for non-numeric id', () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/kanban?detail=job:abc');
    dialogOpenSpy.mockReturnValue({ afterClosed: () => new Subject<void>() });

    const detail = service.getDetailFromUrl();

    expect(detail).toBeNull();
  });

  describe('a malformed detail link', () => {
    let closed$: Subject<void>;

    beforeEach(() => {
      closed$ = new Subject<void>();
      dialogOpenSpy.mockReturnValue({ afterClosed: () => closed$ });
    });

    it.each(['part:abc', 'sales-order:new', 'part:12abc', 'part:0', 'invalid'])('shows the not-found dialog for %s', (detail) => {
      vi.spyOn(router, 'url', 'get').mockReturnValue(`/parts?detail=${detail}`);

      expect(service.getDetailFromUrl()).toBeNull();

      expect(dialogOpenSpy).toHaveBeenCalledWith(DetailNotFoundDialogComponent, expect.any(Object));
    });

    it('shows it once however many callers ask', () => {
      vi.spyOn(router, 'url', 'get').mockReturnValue('/quality/ncrs?detail=ncr:abc');

      service.getDetailFromUrl();
      service.getDetailFromUrl();

      expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
    });

    it('clears the param, keeping the page tab, when the dialog closes', () => {
      vi.spyOn(router, 'url', 'get').mockReturnValue('/admin?tab=training&detail=part:abc');
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

      service.getDetailFromUrl();
      closed$.next();

      expect(navigateSpy.mock.calls[0][0].toString()).toBe('/admin?tab=training');
    });

    it('does not open anything for a well-formed or absent param', () => {
      vi.spyOn(router, 'url', 'get').mockReturnValue('/parts?detail=part:999999');
      expect(service.getDetailFromUrl()).toEqual({ entityType: 'part', entityId: 999999 });
      expect(dialogOpenSpy).not.toHaveBeenCalled();
    });
  });
});
