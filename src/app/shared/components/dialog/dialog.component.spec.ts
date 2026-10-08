import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { DraftService } from '../../services/draft.service';
import { DialogComponent } from './dialog.component';

describe('DialogComponent Escape handling', () => {
  let component: DialogComponent;
  let closedCount: number;
  let openPanels: HTMLElement[];

  beforeEach(() => {
    openPanels = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { openDialogs: [], open: vi.fn() } },
        { provide: DraftService, useValue: { register: vi.fn(), unregister: vi.fn(), loadDraft: vi.fn() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new DialogComponent());
    closedCount = 0;
    component.closed.subscribe(() => closedCount++);
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

  function pressEscape(closesPanel: boolean): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (closesPanel) openPanels.forEach(panel => panel.remove());
    (component as unknown as { onEscapeKey(): void }).onEscapeKey();
  }

  it('closes the dialog when no field overlay is open', () => {
    pressEscape(false);

    expect(closedCount).toBe(1);
  });

  it('leaves the dialog open when Escape closes an open select panel', () => {
    openPanel('mat-mdc-select-panel');

    pressEscape(true);

    expect(closedCount).toBe(0);
  });

  it('leaves the dialog open when Escape closes a visible autocomplete panel', () => {
    openPanel('mat-mdc-autocomplete-panel mat-mdc-autocomplete-visible');

    pressEscape(true);

    expect(closedCount).toBe(0);
  });

  it('leaves the dialog open when Escape closes a datepicker', () => {
    openPanel('mat-datepicker-content');

    pressEscape(true);

    expect(closedCount).toBe(0);
  });

  it('closes on the next Escape once the overlay is gone', () => {
    openPanel('mat-mdc-select-panel');
    pressEscape(true);

    pressEscape(false);

    expect(closedCount).toBe(1);
  });
});
