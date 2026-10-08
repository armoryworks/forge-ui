import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { PinPromptDialogComponent, PinPromptDialogData } from './pin-prompt-dialog.component';

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

function setup(data: PinPromptDialogData | null) {
  const dialogRef = { close: vi.fn() };
  TestBed.configureTestingModule({
    imports: [PinPromptDialogComponent, TranslateModule.forRoot()],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('es', ES);
  translate.use('es');
  const fixture = TestBed.createComponent(PinPromptDialogComponent);
  fixture.detectChanges();
  return { fixture, dialogRef };
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
});
