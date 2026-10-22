import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';

import { ValidationButtonComponent } from './validation-button.component';

@Component({
  standalone: true,
  imports: [ValidationButtonComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-validation-button [violations]="violations" [loading]="busy()">
      <button data-testid="save" (click)="clicks = clicks + 1">Save</button>
    </app-validation-button>
    <app-validation-button [violations]="violations">
      <button data-testid="save-unbound" (click)="unboundClicks = unboundClicks + 1">Save</button>
    </app-validation-button>
    <form [formGroup]="form" (ngSubmit)="submits = submits + 1">
      <input data-testid="field" formControlName="name" />
      <app-validation-button [violations]="violations">
        <button type="submit" data-testid="submit">Submit</button>
      </app-validation-button>
    </form>
  `,
})
class HostComponent {
  readonly violations = signal<string[]>([]);
  readonly busy = signal(false);
  readonly form = new FormGroup({ name: new FormControl('') });
  clicks = 0;
  unboundClicks = 0;
  submits = 0;
}

describe('ValidationButtonComponent · repeat-click guard', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const button = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('lets only the first of two same-frame clicks through', () => {
    button('save').click();
    button('save').click();

    expect(host.clicks).toBe(1);
  });

  it('guards a button whose consumer binds no [loading]', () => {
    button('save-unbound').click();
    button('save-unbound').click();

    expect(host.unboundClicks).toBe(1);
  });

  it('accepts a later click once the screen has rendered', async () => {
    button('save').click();
    await fixture.whenStable();
    fixture.detectChanges();

    button('save').click();

    expect(host.clicks).toBe(2);
  });

  it('blocks clicks while the consumer reports loading', async () => {
    host.busy.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    button('save').click();

    expect(host.clicks).toBe(0);
  });

  it('cancels the second implicit form submission in the same frame', () => {
    const submit = button('submit');
    const first = new MouseEvent('click', { bubbles: true, cancelable: true });
    const second = new MouseEvent('click', { bubbles: true, cancelable: true });

    submit.dispatchEvent(first);
    submit.dispatchEvent(second);

    expect(first.defaultPrevented).toBe(false);
    expect(second.defaultPrevented).toBe(true);
  });
});
