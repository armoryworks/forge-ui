import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';

import { DetailDialogService } from './detail-dialog.service';
import { DialogEscapeService } from './dialog-escape.service';

interface FakeRef {
  keydown$: Subject<KeyboardEvent>;
  closed$: Subject<void>;
  close: ReturnType<typeof vi.fn>;
  componentInstance: unknown;
  componentRef: { injector: { get(token: unknown, fallback: unknown): unknown } } | null;
  disableClose: boolean | undefined;
  keydownEvents(): Subject<KeyboardEvent>;
  afterClosed(): Subject<void>;
}

function fakeRef(componentInstance: unknown = {}, data: unknown = null): FakeRef {
  const keydown$ = new Subject<KeyboardEvent>();
  const closed$ = new Subject<void>();
  const componentRef = {
    injector: { get: (token: unknown, fallback: unknown) => (token === MAT_DIALOG_DATA ? data : fallback) },
  };
  return {
    keydown$, closed$, componentInstance, componentRef,
    disableClose: true,
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
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    afterOpened = new Subject();
    open = vi.fn();
    currentDetail = null;
    panels = [];
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: MatDialog, useValue: { afterOpened, open } },
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

  it('lets a component that implements DialogEscapeHandler handle the Escape', () => {
    const onDialogEscape = vi.fn();
    const ref = opened(fakeRef({ onDialogEscape }));

    ref.keydown$.next(escape());

    expect(onDialogEscape).toHaveBeenCalledTimes(1);
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('closes the ref with no result and calls no cancel() or close() on a component without the handler', () => {
    const cancel = vi.fn();
    const close = vi.fn();
    const ref = opened(fakeRef({ cancel, close }));

    ref.keydown$.next(escape());

    expect(cancel).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith();
  });

  it('keeps a dialog open whose data sets escapeCloses to false', () => {
    const onDialogEscape = vi.fn();
    const ref = opened(fakeRef({ onDialogEscape }, { escapeCloses: false }));
    const tryClose = vi.fn();
    service.register({ hostRef: asRef(ref), tryClose });

    ref.keydown$.next(escape());

    expect(onDialogEscape).not.toHaveBeenCalled();
    expect(tryClose).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('still closes a dialog whose data leaves escapeCloses unset or true', () => {
    const unset = opened(fakeRef({}, { title: 'x' }));
    const allowed = opened(fakeRef({}, { escapeCloses: true }));
    const templateDialog = fakeRef();
    templateDialog.componentRef = null;
    opened(templateDialog);

    unset.keydown$.next(escape());
    allowed.keydown$.next(escape());
    templateDialog.keydown$.next(escape());

    expect(unset.close).toHaveBeenCalledTimes(1);
    expect(allowed.close).toHaveBeenCalledTimes(1);
    expect(templateDialog.close).toHaveBeenCalledTimes(1);
  });

  it('leaves a dialog opened with disableClose false to the CDK', () => {
    const cancel = vi.fn();
    const ref = opened(fakeRef({ cancel }));
    ref.disableClose = false;
    const tryClose = vi.fn();
    service.register({ hostRef: asRef(ref), tryClose });

    ref.keydown$.next(escape());

    expect(cancel).not.toHaveBeenCalled();
    expect(tryClose).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
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

  describe('closeUnlessDirty', () => {
    it('closes a pristine form without asking', () => {
      const close = vi.fn();

      service.closeUnlessDirty(false, close);

      expect(open).not.toHaveBeenCalled();
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('asks before closing a dirty form and closes once the user confirms', () => {
      open.mockReturnValue({ afterClosed: () => of(true) });
      const close = vi.fn();

      service.closeUnlessDirty(true, close);

      expect(open).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('keeps a dirty form open when the user chooses to stay', () => {
      open.mockReturnValue({ afterClosed: () => of(false) });
      const close = vi.fn();

      service.closeUnlessDirty(true, close);

      expect(close).not.toHaveBeenCalled();
    });
  });
});
