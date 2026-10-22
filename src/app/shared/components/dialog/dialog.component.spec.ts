import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ControlContainer } from '@angular/forms';
import { InteractivityChecker } from '@angular/cdk/a11y';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { DetailDialogService } from '../../services/detail-dialog.service';
import { DialogEscapeService } from '../../services/dialog-escape.service';
import { DraftService } from '../../services/draft.service';
import { mockSignalInputs } from '../../../../testing/signal-input-harness';
import { DialogComponent } from './dialog.component';

interface DialogInternals {
  onEscapeKey(): void;
  takeFocus(): void;
  formContainers: () => readonly ControlContainer[];
  panel: () => ElementRef<HTMLElement>;
  closeButton: () => ElementRef<HTMLElement>;
}

const tabbableChecker = {
  isTabbable: (el: HTMLElement) => !el.hasAttribute('disabled') && el.tabIndex >= 0,
  isFocusable: (el: HTMLElement) => !el.hasAttribute('disabled') && el.tabIndex >= -1,
  isVisible: () => true,
  isDisabled: (el: HTMLElement) => el.hasAttribute('disabled'),
};

function configure(options: { hostRef?: MatDialogRef<unknown>; openDialogs?: MatDialogRef<unknown>[]; host?: HTMLElement; confirmResult?: boolean } = {}) {
  const open = vi.fn().mockReturnValue({ afterClosed: () => of(options.confirmResult ?? false) });
  const providers: unknown[] = [
    provideTranslateService(),
    { provide: MatDialog, useValue: { openDialogs: options.openDialogs ?? [], open } },
    { provide: DraftService, useValue: { register: vi.fn(), unregister: vi.fn(), loadDraft: vi.fn() } },
    { provide: DetailDialogService, useValue: { isCurrent: () => false } },
    { provide: InteractivityChecker, useValue: tabbableChecker },
    { provide: ElementRef, useValue: new ElementRef(options.host ?? document.createElement('app-dialog')) },
  ];
  if (options.hostRef) providers.push({ provide: MatDialogRef, useValue: options.hostRef });
  TestBed.configureTestingModule({ providers: providers as never[] });
  return { open };
}

function create(dirty?: boolean, forms: Partial<ControlContainer>[] = []): { component: DialogComponent; internals: DialogInternals; closedCount: () => number } {
  const component = TestBed.runInInjectionContext(() => new DialogComponent());
  mockSignalInputs(component, { dirty, draftConfig: null, draftFormGroup: null, title: 'Test' });
  Object.defineProperty(component, 'formContainers', { value: () => forms, configurable: true });
  let count = 0;
  component.closed.subscribe(() => count++);
  return { component, internals: component as unknown as DialogInternals, closedCount: () => count };
}

describe('DialogComponent Escape handling', () => {
  let openPanels: HTMLElement[];

  beforeEach(() => {
    openPanels = [];
  });

  afterEach(() => {
    openPanels.forEach(panel => panel.remove());
  });

  function openPanel(className: string): void {
    const panel = document.createElement('div');
    panel.className = className;
    document.body.appendChild(panel);
    openPanels.push(panel);
  }

  function pressEscape(internals: DialogInternals, closesPanel: boolean): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (closesPanel) openPanels.forEach(panel => panel.remove());
    internals.onEscapeKey();
  }

  it('closes the dialog when no field overlay is open', () => {
    configure();
    const dialog = create();

    pressEscape(dialog.internals, false);

    expect(dialog.closedCount()).toBe(1);
  });

  it('leaves the dialog open when Escape closes an open select panel', () => {
    configure();
    const dialog = create();
    openPanel('mat-mdc-select-panel');

    pressEscape(dialog.internals, true);

    expect(dialog.closedCount()).toBe(0);
  });

  it('leaves the dialog open when Escape closes a visible autocomplete panel', () => {
    configure();
    const dialog = create();
    openPanel('mat-mdc-autocomplete-panel mat-mdc-autocomplete-visible');

    pressEscape(dialog.internals, true);

    expect(dialog.closedCount()).toBe(0);
  });

  it('leaves the dialog open when Escape closes a datepicker', () => {
    configure();
    const dialog = create();
    openPanel('mat-datepicker-content');

    pressEscape(dialog.internals, true);

    expect(dialog.closedCount()).toBe(0);
  });

  it('closes on the next Escape once the overlay is gone', () => {
    configure();
    const dialog = create();
    openPanel('mat-mdc-select-panel');
    pressEscape(dialog.internals, true);

    pressEscape(dialog.internals, false);

    expect(dialog.closedCount()).toBe(1);
  });

  it('closes only the innermost of nested inline dialogs', () => {
    configure();
    const outer = create();
    const inner = create();

    outer.internals.onEscapeKey();
    inner.internals.onEscapeKey();

    expect(outer.closedCount()).toBe(0);
    expect(inner.closedCount()).toBe(1);
  });

  it('leaves an inline dialog to the MatDialog stacked over it', () => {
    configure({ openDialogs: [{ id: 'confirm' } as MatDialogRef<unknown>] });
    const dialog = create();

    dialog.internals.onEscapeKey();

    expect(dialog.closedCount()).toBe(0);
  });
});

describe('DialogComponent inside a MatDialog', () => {
  const hostRef = { id: 'host' } as MatDialogRef<unknown>;

  it('ignores the document Escape', () => {
    configure({ hostRef, openDialogs: [hostRef] });
    const dialog = create();

    dialog.internals.onEscapeKey();

    expect(dialog.closedCount()).toBe(0);
  });

  it('registers with the escape service so Escape on its MatDialog closes it through tryClose', () => {
    configure({ hostRef, openDialogs: [hostRef] });
    const register = vi.spyOn(TestBed.inject(DialogEscapeService), 'register');
    const dialog = create();

    const target = register.mock.calls[0][0];
    target.tryClose();

    expect(target.hostRef).toBe(hostRef);
    expect(dialog.closedCount()).toBe(1);
  });
});

describe('DialogComponent unsaved-changes check', () => {
  it('asks before closing when a form inside the dialog is dirty and no dirty flag is bound', () => {
    const { open } = configure();
    const dialog = create(undefined, [{ dirty: true } as Partial<ControlContainer>]);

    dialog.component.tryClose();

    expect(open).toHaveBeenCalled();
    expect(dialog.closedCount()).toBe(0);
  });

  it('closes at once when every form inside the dialog is pristine', () => {
    const { open } = configure();
    const dialog = create(undefined, [{ dirty: false } as Partial<ControlContainer>]);

    dialog.component.tryClose();

    expect(open).not.toHaveBeenCalled();
    expect(dialog.closedCount()).toBe(1);
  });

  it('closes after the user confirms discarding the changes', () => {
    configure({ confirmResult: true });
    const dialog = create(undefined, [{ dirty: true } as Partial<ControlContainer>]);

    dialog.component.tryClose();

    expect(dialog.closedCount()).toBe(1);
  });

  it('does not ask about a form left dirty from before the dialog opened until its value changes', () => {
    const { open } = configure();
    const form = { dirty: true, value: { name: 'old' } } as Partial<ControlContainer> as { dirty: boolean; value: unknown };
    const dialog = create(undefined, [form as Partial<ControlContainer>]);
    Object.defineProperty(dialog.internals, 'panel', { value: () => new ElementRef(document.createElement('div')) });
    dialog.internals.takeFocus();

    dialog.component.tryClose();
    expect(open).not.toHaveBeenCalled();

    form.value = { name: 'typed' };
    dialog.component.tryClose();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('lets a bound dirty flag win over the forms inside', () => {
    const { open } = configure();
    const dialog = create(false, [{ dirty: true } as Partial<ControlContainer>]);

    dialog.component.tryClose();

    expect(open).not.toHaveBeenCalled();
    expect(dialog.closedCount()).toBe(1);
  });
});

describe('DialogComponent focus', () => {
  let fixtureRoot: HTMLElement;

  beforeEach(() => {
    fixtureRoot = document.createElement('div');
    document.body.appendChild(fixtureRoot);
  });

  afterEach(() => {
    fixtureRoot.remove();
  });

  function buildDialog(parent: HTMLElement, bodyHtml: string): { host: HTMLElement; panel: HTMLElement; close: HTMLElement } {
    const host = document.createElement('app-dialog');
    host.innerHTML = `
      <div class="dialog">
        <div class="dialog__header"><button class="close-x">x</button></div>
        <div class="dialog__body">${bodyHtml}</div>
        <div class="dialog__footer"><button class="footer-cancel">Cancel</button></div>
      </div>`;
    parent.appendChild(host);
    return { host, panel: host.querySelector('.dialog')!, close: host.querySelector('.close-x')! };
  }

  function withView(internals: DialogInternals, panel: HTMLElement, close: HTMLElement): void {
    Object.defineProperty(internals, 'panel', { value: () => new ElementRef(panel), configurable: true });
    Object.defineProperty(internals, 'closeButton', { value: () => new ElementRef(close), configurable: true });
  }

  it('moves focus from the opener to the first field of an inline dialog, past an autocomplete', () => {
    const opener = document.createElement('button');
    fixtureRoot.appendChild(opener);
    opener.focus();
    const { host, panel, close } = buildDialog(fixtureRoot,
      '<app-draft-recovery-banner><button class="banner">Discard</button></app-draft-recovery-banner>'
      + '<input class="part mat-mdc-autocomplete-trigger"><input class="name">');
    configure({ host });
    const dialog = create();
    withView(dialog.internals, panel, close);

    dialog.internals.takeFocus();

    expect(document.activeElement).toBe(panel.querySelector('.name'));
  });

  it('falls back to the footer when the body has nothing to focus', () => {
    const { host, panel, close } = buildDialog(fixtureRoot, '<p>Read only</p>');
    configure({ host });
    const dialog = create();
    withView(dialog.internals, panel, close);

    dialog.internals.takeFocus();

    expect(document.activeElement).toBe(panel.querySelector('.footer-cancel'));
  });

  it('returns focus to the opener when an inline dialog closes', () => {
    const opener = document.createElement('button');
    fixtureRoot.appendChild(opener);
    opener.focus();
    const { host, panel, close } = buildDialog(fixtureRoot, '<input class="name">');
    configure({ host });
    const dialog = create();
    withView(dialog.internals, panel, close);
    dialog.internals.takeFocus();

    TestBed.resetTestingModule();

    expect(document.activeElement).toBe(opener);
  });

  it('marks the first field cdkFocusInitial for the MatDialog it is the shell of, and corrects focus left on the X', () => {
    const surface = document.createElement('div');
    surface.className = 'mat-mdc-dialog-surface';
    const contentHost = document.createElement('app-new-part-dialog');
    surface.appendChild(contentHost);
    fixtureRoot.appendChild(surface);
    const { host, panel, close } = buildDialog(contentHost, '<input class="name">');
    const hostRef = { id: 'shell' } as MatDialogRef<unknown>;
    configure({ host, hostRef, openDialogs: [hostRef] });
    const dialog = create();
    withView(dialog.internals, panel, close);
    close.focus();

    dialog.internals.takeFocus();

    const field = panel.querySelector('.name')!;
    expect(field.hasAttribute('cdkFocusInitial')).toBe(true);
    expect(document.activeElement).toBe(field);
  });

  it('treats an app-dialog opened straight from a template as the shell of its MatDialog', () => {
    const surface = document.createElement('div');
    surface.className = 'mat-mdc-dialog-surface';
    fixtureRoot.appendChild(surface);
    const { host, panel, close } = buildDialog(surface, '<input class="name">');
    const hostRef = { id: 'template' } as MatDialogRef<unknown>;
    configure({ host, hostRef, openDialogs: [hostRef] });
    const dialog = create();
    withView(dialog.internals, panel, close);

    dialog.internals.takeFocus();

    expect(panel.querySelector('.name')!.hasAttribute('cdkFocusInitial')).toBe(true);
    expect(panel.parentElement!.querySelectorAll('.cdk-focus-trap-anchor').length).toBe(0);
  });

  it('treats an app-dialog as the shell when the material container adds wrappers above the surface', () => {
    const container = document.createElement('mat-dialog-container');
    const inner = document.createElement('div');
    inner.className = 'mat-mdc-dialog-inner-container';
    const surface = document.createElement('div');
    surface.className = 'mat-mdc-dialog-surface';
    const contentHost = document.createElement('app-new-part-dialog');
    surface.appendChild(contentHost);
    inner.appendChild(surface);
    container.appendChild(inner);
    fixtureRoot.appendChild(container);
    const { host, panel, close } = buildDialog(contentHost, '<input class="name">');
    const hostRef = { id: 'wrapped' } as MatDialogRef<unknown>;
    configure({ host, hostRef, openDialogs: [hostRef] });
    const dialog = create();
    withView(dialog.internals, panel, close);

    dialog.internals.takeFocus();

    expect(panel.querySelector('.name')!.hasAttribute('cdkFocusInitial')).toBe(true);
  });

  it('leaves focus alone in a MatDialog shell when the container focused itself', () => {
    const surface = document.createElement('div');
    surface.className = 'mat-mdc-dialog-surface';
    surface.tabIndex = -1;
    const contentHost = document.createElement('app-detail');
    surface.appendChild(contentHost);
    fixtureRoot.appendChild(surface);
    const { host, panel, close } = buildDialog(contentHost, '<input class="name">');
    const hostRef = { id: 'detail' } as MatDialogRef<unknown>;
    configure({ host, hostRef, openDialogs: [hostRef] });
    const dialog = create();
    withView(dialog.internals, panel, close);
    surface.focus();

    dialog.internals.takeFocus();

    expect(document.activeElement).toBe(surface);
  });

  it('traps focus inside an inline dialog nested in a MatDialog that is not its shell', () => {
    const surface = document.createElement('div');
    surface.className = 'mat-mdc-dialog-surface';
    const contentHost = document.createElement('app-job-detail');
    const wrapper = document.createElement('section');
    contentHost.appendChild(wrapper);
    surface.appendChild(contentHost);
    fixtureRoot.appendChild(surface);
    const trigger = document.createElement('button');
    wrapper.appendChild(trigger);
    trigger.focus();
    const { host, panel, close } = buildDialog(wrapper, '<input class="reason">');
    const hostRef = { id: 'detail' } as MatDialogRef<unknown>;
    configure({ host, hostRef, openDialogs: [hostRef] });
    const dialog = create();
    withView(dialog.internals, panel, close);

    dialog.internals.takeFocus();

    expect(document.activeElement).toBe(panel.querySelector('.reason'));
    expect(panel.parentElement!.querySelectorAll('.cdk-focus-trap-anchor').length).toBe(2);
  });
});
