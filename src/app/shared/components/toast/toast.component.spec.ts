import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';

import { ToastService } from '../../services/toast.service';
import { ToastContainerComponent } from './toast.component';

@Component({ selector: 'app-toast-spec-dialog', standalone: true, template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class SpecDialogComponent {}

describe('ToastContainerComponent top layer', () => {
  let host: HTMLElement;
  let toasts: ToastService;
  let open: boolean;
  let show: ReturnType<typeof vi.fn>;
  let hide: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ToastContainerComponent], providers: [provideNoopAnimations(), provideTranslateService()] });
    const fixture = TestBed.createComponent(ToastContainerComponent);
    host = fixture.nativeElement as HTMLElement;
    toasts = TestBed.inject(ToastService);
    open = false;
    show = vi.fn(() => { open = true; });
    hide = vi.fn(() => { open = false; });
    Object.assign(host, { showPopover: show, hidePopover: hide });
    const matches = host.matches.bind(host);
    vi.spyOn(host, 'matches').mockImplementation((selector: string) => (selector === ':popover-open' ? open : matches(selector)));
    fixture.detectChanges();
  });

  it('is a manual popover so it can sit above CDK overlays in the top layer', () => {
    expect(host.getAttribute('popover')).toBe('manual');
    expect(show).not.toHaveBeenCalled();
  });

  it('shows itself when a toast arrives and re-raises above overlays opened since', () => {
    toasts.show({ severity: 'warning', title: 'First' });
    TestBed.tick();
    expect(show).toHaveBeenCalledTimes(1);

    toasts.show({ severity: 'error', title: 'Second' });
    TestBed.tick();
    expect(hide).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledTimes(2);
  });

  it('hides itself once the last toast is dismissed', () => {
    toasts.show({ severity: 'info', title: 'Only' });
    TestBed.tick();
    toasts.dismiss(toasts.toasts()[0].id);
    TestBed.tick();

    expect(open).toBe(false);
  });

  it('re-raises a visible toast above a dialog opened after it', () => {
    toasts.show({ severity: 'warning', title: 'Before the dialog' });
    TestBed.tick();
    expect(show).toHaveBeenCalledTimes(1);

    TestBed.inject(MatDialog).open(SpecDialogComponent);

    expect(hide).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledTimes(2);
    expect(open).toBe(true);
  });

  it('stays hidden when a dialog opens with no toast showing', () => {
    TestBed.inject(MatDialog).open(SpecDialogComponent);

    expect(show).not.toHaveBeenCalled();
  });
});
