import { describe, it, expect, afterEach } from 'vitest';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';

import { focusCancelOnOpen } from './focus-dialog-cancel';

function dialog(): { ref: MatDialogRef<unknown, unknown>; opened: Subject<void>; cancel: HTMLButtonElement; other: HTMLButtonElement } {
  const container = document.createElement('div');
  container.id = 'mat-mdc-dialog-7';
  const other = document.createElement('button');
  const cancel = document.createElement('button');
  cancel.dataset['testid'] = 'confirm-dialog-cancel';
  container.append(other, cancel);
  document.body.append(container);
  const opened = new Subject<void>();
  const ref = { id: container.id, afterOpened: () => opened } as unknown as MatDialogRef<unknown, unknown>;
  return { ref, opened, cancel, other };
}

describe('focusCancelOnOpen', () => {
  afterEach(() => document.body.replaceChildren());

  it('moves focus from the page into the dialog Cancel button once it opens', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    const { ref, opened, cancel } = dialog();

    focusCancelOnOpen(ref);
    opened.next();

    expect(document.activeElement).toBe(cancel);
  });

  it('leaves focus alone when the dialog already holds it', () => {
    const { ref, opened, other } = dialog();
    other.focus();

    focusCancelOnOpen(ref);
    opened.next();

    expect(document.activeElement).toBe(other);
  });
});
