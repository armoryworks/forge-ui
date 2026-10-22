import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { PinPromptDialogComponent, PinPromptDialogData } from './pin-prompt-dialog.component';
import { DialogEscapeService } from '../../../../shared/services/dialog-escape.service';

const ES = {
  common: { cancel: 'Cancelar', confirm: 'Confirmar' },
  kioskFlows: {
    pin: {
      title: 'Ingrese el PIN para revertir',
      placeholder: 'Ingrese el PIN',
      aria: 'PIN',
      confirmAria: 'Confirmar PIN',
      lengthError: 'El PIN debe tener de 4 a 6 dígitos',
      digitsOnly: 'El PIN solo puede contener números',
    },
  },
};

function escapeStub(confirmed: boolean) {
  return {
    closeUnlessDirty: vi.fn((dirty: boolean, close: () => void) => {
      if (!dirty || confirmed) close();
    }),
  };
}

function setup(data: PinPromptDialogData | null, escape = escapeStub(false)) {
  const dialogRef = { close: vi.fn() };
  TestBed.configureTestingModule({
    imports: [PinPromptDialogComponent, TranslateModule.forRoot()],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: DialogEscapeService, useValue: escape },
    ],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('es', ES);
  translate.use('es');
  const fixture = TestBed.createComponent(PinPromptDialogComponent);
  fixture.detectChanges();
  return { fixture, dialogRef, escape };
}

describe('PinPromptDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders the default title, field and buttons in Spanish', () => {
    const { fixture } = setup(null);
    const el: HTMLElement = fixture.nativeElement;
    const input = el.querySelector<HTMLInputElement>('[data-testid="pin-prompt-input"]')!;

    expect(el.querySelector('h2')!.textContent).toContain('Ingrese el PIN para revertir');
    expect(input.placeholder).toBe('Ingrese el PIN');
    expect(el.textContent).toContain('Cancelar');
    expect(el.textContent).toContain('Confirmar');
    expect(el.textContent).not.toMatch(/Enter PIN|Cancel\b|Confirm\b/);
  });

  it('keeps a caller-supplied title', () => {
    const { fixture } = setup({ title: 'Título propio' });

    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Título propio');
  });

  it('shows the validation errors in Spanish', () => {
    const { fixture, dialogRef } = setup(null);
    const dialog = fixture.componentInstance;

    dialog.pinControl.setValue('12');
    dialog.confirm();
    expect(dialog.error()).toBe('El PIN debe tener de 4 a 6 dígitos');

    dialog.pinControl.setValue('12a4');
    dialog.confirm();
    expect(dialog.error()).toBe('El PIN solo puede contener números');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  describe('Escape', () => {
    it('cancels straight away while no PIN is typed', () => {
      const { fixture, dialogRef, escape } = setup(null);

      fixture.componentInstance.onDialogEscape();

      expect(escape.closeUnlessDirty).toHaveBeenCalledWith(false, expect.any(Function));
      expect(dialogRef.close).toHaveBeenCalledWith(null);
    });

    it('keeps a typed PIN when the discard prompt is declined', () => {
      const { fixture, dialogRef, escape } = setup(null);
      fixture.componentInstance.pinControl.setValue('12');

      fixture.componentInstance.onDialogEscape();

      expect(escape.closeUnlessDirty).toHaveBeenCalledWith(true, expect.any(Function));
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('cancels with a typed PIN once the discard is confirmed', () => {
      const { fixture, dialogRef } = setup(null, escapeStub(true));
      fixture.componentInstance.pinControl.setValue('12');

      fixture.componentInstance.onDialogEscape();

      expect(dialogRef.close).toHaveBeenCalledWith(null);
    });
  });
});
