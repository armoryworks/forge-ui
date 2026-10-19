import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Observable, of } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';

import { ScanResolveResult } from '../../../../shared/models/mobile-api.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { ScanActionSheetComponent } from './scan-action-sheet.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const job: ScanResolveResult = { kind: 'job', id: 42, code: 'JOB-42', label: 'JOB-42', subtitle: null };
const purchaseOrder: ScanResolveResult = { kind: 'purchaseOrder', id: 8, code: 'PO-1008', label: 'PO-1008', subtitle: null };

describe('ScanActionSheetComponent', () => {
  let fixture: ComponentFixture<ScanActionSheetComponent>;
  let purchasing: boolean;
  let roles: string[];

  function render(runningJobId: number | null, actingAs: string | null = null, result = job): HTMLElement {
    fixture = TestBed.createComponent(ScanActionSheetComponent);
    fixture.componentRef.setInput('result', result);
    fixture.componentRef.setInput('runningJobId', runningJobId);
    fixture.componentRef.setInput('actingAs', actingAs);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    purchasing = true;
    roles = ['Procurement'];
    TestBed.configureTestingModule({
      imports: [ScanActionSheetComponent],
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code !== 'CAP-P2P-PO' || purchasing } },
        { provide: AuthService, useValue: { hasAnyRole: (allowed: string[]) => roles.some(r => allowed.includes(r)) } },
      ],
    });
  });

  it('offers Start when no timer runs on this job', () => {
    const el = render(7);
    expect(el.querySelector('[data-testid="scan-action-start"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="scan-action-stop"]')).toBeNull();
  });

  it('swaps Start for Stop while the timer runs on this job', () => {
    const el = render(42);
    const chosen = vi.fn();
    fixture.componentInstance.chosen.subscribe(chosen);

    expect(el.querySelector('[data-testid="scan-action-start"]')).toBeNull();
    el.querySelector<HTMLButtonElement>('[data-testid="scan-action-stop"]')!.click();

    expect(chosen).toHaveBeenCalledWith('stop');
  });

  it('shows who is acting and lets someone else say it is not them', () => {
    const el = render(null, 'Ana Ruiz');
    const notYou = vi.fn();
    fixture.componentInstance.notYou.subscribe(notYou);

    expect(el.querySelector('[data-testid="scan-acting-as"]')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('[data-testid="scan-not-you"]')!.click();

    expect(notYou).toHaveBeenCalledOnce();
  });

  it('hides the acting-as line when nobody is identified', () => {
    expect(render(null).querySelector('[data-testid="scan-acting-as"]')).toBeNull();
  });

  it('offers Receive first for a purchase order', () => {
    const el = render(null, null, purchaseOrder);
    const chosen = vi.fn();
    fixture.componentInstance.chosen.subscribe(chosen);

    const receive = el.querySelector<HTMLButtonElement>('[data-testid="scan-action-receive"]')!;
    expect(receive.classList).toContain('sheet__action--primary');
    expect(el.querySelector('[data-testid="scan-action-start"]')).toBeNull();
    receive.click();

    expect(chosen).toHaveBeenCalledWith('receive');
  });

  it('offers only Open on desktop for a purchase order while purchasing is off', () => {
    purchasing = false;
    const el = render(null, null, purchaseOrder);

    expect(el.querySelector('[data-testid="scan-action-receive"]')).toBeNull();
    expect(el.querySelector('[data-testid="scan-action-details"]')).not.toBeNull();
  });

  it('offers only Open on desktop for a purchase order to a production worker, who cannot receive it', () => {
    roles = ['ProductionWorker'];
    const el = render(null, null, purchaseOrder);

    expect(el.querySelector('[data-testid="scan-action-receive"]')).toBeNull();
    expect(el.querySelector('[data-testid="scan-action-details"]')).not.toBeNull();
  });

  it('says Open on desktop for a part, since the phone has no part page', () => {
    const el = render(null, null, { kind: 'part', id: 3, code: 'PRT-SA-210', label: 'SA-210', subtitle: null });

    expect(el.querySelector('[data-testid="scan-action-details"]')!.textContent).toContain('mobileApp.scan.actions.openOnDesktop');
  });

  it('is a modal dialog that Escape cancels', () => {
    const el = render(null);
    let dismissed = 0;
    fixture.componentInstance.dismissed.subscribe(() => dismissed++);
    const sheet = el.querySelector<HTMLElement>('[data-testid="scan-action-sheet"]')!;

    expect(sheet.getAttribute('aria-modal')).toBe('true');
    sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(dismissed).toBe(1);
  });
});
