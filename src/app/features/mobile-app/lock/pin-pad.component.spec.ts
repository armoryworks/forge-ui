import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TranslateModule } from '@ngx-translate/core';

import { PinPadComponent } from './pin-pad.component';

describe('PinPadComponent', () => {
  let fixture: ComponentFixture<PinPadComponent>;
  let emitted: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinPadComponent, TranslateModule.forRoot()],
    }).compileComponents();
    fixture = TestBed.createComponent(PinPadComponent);
    emitted = [];
    fixture.componentInstance.completed.subscribe((pin) => emitted.push(pin));
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const key = (id: string): HTMLButtonElement | null =>
    el().querySelector<HTMLButtonElement>(`[data-testid="pin-key-${id}"]`);
  const type = (digits: string): void => {
    for (const d of digits) key(d)!.click();
    fixture.detectChanges();
  };
  const dotCount = (): number => el().querySelectorAll('.pin-pad__dot').length;

  it('submits a fixed-length PIN on the last digit and shows no OK key', () => {
    fixture.detectChanges();
    expect(key('ok')).toBeNull();
    expect(dotCount()).toBe(6);

    type('12345');
    expect(emitted).toEqual([]);
    type('6');
    expect(emitted).toEqual(['123456']);
  });

  describe('variable length', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('minLength', 4);
      fixture.componentRef.setInput('maxLength', 8);
      fixture.detectChanges();
    });

    it('enables OK only once the minimum is reached', () => {
      expect(key('ok')!.disabled).toBe(true);
      type('123');
      expect(key('ok')!.disabled).toBe(true);
      type('4');
      expect(key('ok')!.disabled).toBe(false);
    });

    it('never auto-submits and stops accepting digits at the maximum', () => {
      type('1234567890');
      expect(emitted).toEqual([]);
      expect(dotCount()).toBe(8);

      key('ok')!.click();
      expect(emitted).toEqual(['12345678']);
    });

    it('submits a six-digit PIN on OK and clears the entry', () => {
      type('246810');
      key('ok')!.click();
      fixture.detectChanges();

      expect(emitted).toEqual(['246810']);
      expect(el().querySelectorAll('.pin-pad__dot--filled').length).toBe(0);
      expect(key('ok')!.disabled).toBe(true);
    });

    it('shows the minimum number of slots and grows with the entry', () => {
      expect(dotCount()).toBe(4);
      type('123456');
      expect(dotCount()).toBe(6);
    });
  });
});
