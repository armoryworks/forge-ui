import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';

import { DetailDialogService } from './detail-dialog.service';
import { DialogEscapeService } from './dialog-escape.service';

interface FakeRef {
  keydown$: Subject<KeyboardEvent>;
  closed$: Subject<void>;
  close: ReturnType<typeof vi.fn>;
  componentInstance: unknown;
  keydownEvents(): Subject<KeyboardEvent>;
  afterClosed(): Subject<void>;
}

function fakeRef(componentInstance: unknown = {}): FakeRef {
  const keydown$ = new Subject<KeyboardEvent>();
  const closed$ = new Subject<void>();
  return {
    keydown$, closed$, componentInstance,
    close: vi.fn(),
    keydownEvents: () => keydown$,
    afterClosed: () => closed$,
  };
}

function escape(init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, ...init });
}

describe('DialogEscapeService', () => {
  let afterOpened: Subject<MatDialogRef<unknown>>;
  let currentDetail: unknown;
  let service: DialogEscapeService;
  let panels: HTMLElement[];

  beforeEach(() => {
    afterOpened = new Subject();
    currentDetail = null;
    panels = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { afterOpened } },
        { provide: DetailDialogService, useValue: { isCurrent: (ref: unknown) => ref === currentDetail } },
      ],
    });
    service = TestBed.inject(DialogEscapeService);
    service.start();
  });

  afterEach(() => panels.forEach(panel => panel.remove()));

  function opened(ref: FakeRef): FakeRef {
    afterOpened.next(ref as unknown as MatDialogRef<unknown>);
    return ref;
  }

  function asRef(ref: FakeRef): MatDialogRef<unknown, unknown> {
    return ref as unknown as MatDialogRef<unknown, unknown>;
  }

  it('closes the innermost app-dialog registered for the dialog through tryClose', () => {
    const ref = opened(fakeRef());
    const outer = vi.fn();
    const inner = vi.fn();
    service.register({ hostRef: asRef(ref), tryClose: outer });
    service.register({ hostRef: asRef(ref), tryClose: inner });

    ref.keydown$.next(escape());

    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('falls back to the outer app-dialog once the inner one unregisters', () => {
    const ref = opened(fakeRef());
    const outer = vi.fn();
    service.register({ hostRef: asRef(ref), tryClose: outer });
    const unregister = service.register({ hostRef: asRef(ref), tryClose: vi.fn() });

    unregister();
    ref.keydown$.next(escape());

    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('cancels a confirm-style dialog through its own cancel()', () => {
    const cancel = vi.fn();
    const close = vi.fn();
    const ref = opened(fakeRef({ cancel, close }));

    ref.keydown$.next(escape());

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('uses the component close() when there is no cancel()', () => {
    const close = vi.fn();
    const ref = opened(fakeRef({ close }));

    ref.keydown$.next(escape());

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the ref with no result when the component has neither', () => {
    const ref = opened(fakeRef({ save: () => undefined, close: (result: unknown) => result }));

    ref.keydown$.next(escape());

    expect(ref.close).toHaveBeenCalledWith();
  });

  it('leaves a detail dialog without an app-dialog to the detail dialog service', () => {
    const ref = opened(fakeRef());
    currentDetail = ref;

    ref.keydown$.next(escape());

    expect(ref.close).not.toHaveBeenCalled();
  });

  it('closes an app-dialog nested in the current detail dialog', () => {
    const ref = opened(fakeRef());
    currentDetail = ref;
    const tryClose = vi.fn();
    service.register({ hostRef: asRef(ref), tryClose });

    ref.keydown$.next(escape());

    expect(tryClose).toHaveBeenCalledTimes(1);
  });

  it('ignores an Escape another handler already consumed or one with a modifier', () => {
    const ref = opened(fakeRef());
    const consumed = escape();
    consumed.preventDefault();

    ref.keydown$.next(consumed);
    ref.keydown$.next(escape({ shiftKey: true }));
    ref.keydown$.next(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(ref.close).not.toHaveBeenCalled();
  });

  it('ignores the Escape that closes an open autocomplete panel', () => {
    const ref = opened(fakeRef());
    const panel = document.createElement('div');
    panel.className = 'mat-mdc-autocomplete-panel mat-mdc-autocomplete-visible';
    document.body.appendChild(panel);
    panels.push(panel);

    document.dispatchEvent(escape());
    panel.remove();
    ref.keydown$.next(escape());

    expect(ref.close).not.toHaveBeenCalled();
  });

  it('stops listening once the dialog has closed', () => {
    const ref = opened(fakeRef());
    ref.closed$.next();

    ref.keydown$.next(escape());

    expect(ref.close).not.toHaveBeenCalled();
  });

  it('reports only the latest dialog on the same host as topmost', () => {
    const first = { hostRef: null, tryClose: vi.fn() };
    const second = { hostRef: null, tryClose: vi.fn() };
    service.register(first);
    service.register(second);

    expect(service.isTopmost(first)).toBe(false);
    expect(service.isTopmost(second)).toBe(true);
  });
});
