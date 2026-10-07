import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, WritableSignal, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, NG_VALUE_ACCESSOR } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { InputComponent } from '../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { LayoutService } from '../../shared/services/layout.service';
import { SetupComponent } from './setup.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

// Two shared wrappers can't be rendered under TestBed: their `input.required`
// values read as unset during the same change detection that binds them (NG0950).
// This bites the wizard's own steps identically, so it's a harness limitation
// rather than anything about the gate — stub both and keep the real template.

/** Projects its content so the wrapped button's text still shows up in assertions. */
@Component({
  selector: 'app-validation-button',
  standalone: true,
  template: '<ng-content />',
})
class StubValidationButtonComponent {
  readonly violations = input<unknown>();
  readonly violationItems = input<unknown>();
  readonly loading = input<unknown>();
}

/**
 * Renders its label, and is a no-op value accessor so `formControlName` still binds.
 * Mirrors InputComponent's whole input surface, not just what the gate binds — a
 * missing one is an NG0303 unknown-property error, and this stub replaces the real
 * component across every step of the wizard's template.
 */
@Component({
  selector: 'app-input',
  standalone: true,
  template: '<span>{{ label() }}</span>',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: StubInputComponent, multi: true }],
})
class StubInputComponent {
  readonly label = input('');
  readonly type = input('text');
  readonly info = input('');
  readonly placeholder = input('');
  readonly prefix = input('');
  readonly suffix = input('');
  readonly isReadonly = input(false);
  readonly maxlength = input<number | null>(null);
  readonly autocomplete = input('off');
  readonly mask = input<string | null>(null);
  readonly required = input(false);
  readonly step = input<string | number | null>(null);
  readonly min = input<string | number | null>(null);
  readonly max = input<string | number | null>(null);
  writeValue(): void { /* no-op */ }
  registerOnChange(): void { /* no-op */ }
  registerOnTouched(): void { /* no-op */ }
}

/** Protected members the gate tests exercise. */
interface SetupInternals {
  statusChecked(): boolean;
  activationRequired(): boolean;
  activationChecking(): boolean;
  activationForm: FormGroup<{ code: FormControl<string | null> }>;
  step: WritableSignal<number>;
  selectedModuleIds(): Set<string>;
  unlock(): void;
  choosePath(path: 'quick' | 'full'): void;
  onSubmit(): void;
  accountForm: FormGroup;
  companyForm: FormGroup;
}

const STATUS_URL = `${environment.apiUrl}/auth/status`;
const VERIFY_URL = `${environment.apiUrl}/auth/setup/verify-activation`;
const SETUP_URL = `${environment.apiUrl}/auth/setup`;
const MODULES_URL = `${environment.apiUrl}/auth/setup/modules`;

const MODULES_RESPONSE = {
  modules: ['inventory', 'purchasing', 'sales', 'production', 'shipping', 'invoicing', 'quality', 'planning', 'people']
    .map(id => ({ id, name: id, summary: '', prerequisiteNote: '', defaultSelected: id === 'inventory' })),
  bundles: [{
    id: 'job-shop',
    name: 'Job shop',
    moduleIds: ['sales', 'production', 'purchasing', 'shipping', 'invoicing', 'inventory'],
  }],
};

function configure(): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideNoopAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });
}

// Constructs without rendering (same pattern as the quote-dialog spec) and leaves
// the constructor's status call UNFLUSHED, so a test can assert what the screen
// looks like before the server has answered.
function setup() {
  configure();
  const component = TestBed.runInInjectionContext(() => new SetupComponent());
  const httpMock = TestBed.inject(HttpTestingController);

  return { component: component as unknown as SetupInternals, httpMock };
}

// Renders the real template — the only way to prove which screen a customer is
// actually looking at.
function render() {
  configure();
  TestBed.overrideComponent(SetupComponent, {
    remove: { imports: [ValidationButtonComponent, InputComponent] },
    add: { imports: [StubValidationButtonComponent, StubInputComponent] },
  });
  const fixture: ComponentFixture<SetupComponent> = TestBed.createComponent(SetupComponent);
  const httpMock = TestBed.inject(HttpTestingController);
  fixture.detectChanges();

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const showsFork = () => text().includes('auth.fork.quickName');
  const showsGate = () => text().includes('auth.activation.lede');

  return { fixture, httpMock, showsFork, showsGate };
}

/** Answers the constructor's status call. */
function flushStatus(
  httpMock: HttpTestingController,
  body: { setupRequired: boolean; activationRequired: boolean },
): void {
  httpMock.expectOne(STATUS_URL).flush(body);
}

describe('SetupComponent — activation gate', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows neither the gate nor the wizard until the status call answers', () => {
    // Regression pin: activationRequired defaults to false, so rendering off it
    // alone would flash the setup fork — the very screen the gate withholds —
    // and only then swap it for the gate. The template waits on statusChecked().
    const { showsFork, showsGate } = render();

    expect(showsFork()).toBe(false);
    expect(showsGate()).toBe(false);
  });

  it('renders the gate, not the fork, once a provisioned install answers', () => {
    const { fixture, httpMock, showsFork, showsGate } = render();

    flushStatus(httpMock, { setupRequired: true, activationRequired: true });
    fixture.detectChanges();

    expect(showsGate()).toBe(true);
    expect(showsFork()).toBe(false);
  });

  it('renders the fork once a self-hosted install answers', () => {
    const { fixture, httpMock, showsFork, showsGate } = render();

    flushStatus(httpMock, { setupRequired: false, activationRequired: false });
    fixture.detectChanges();

    expect(showsFork()).toBe(true);
    expect(showsGate()).toBe(false);
  });

  it('gates a provisioned install', () => {
    const { component, httpMock } = setup();

    flushStatus(httpMock, { setupRequired: true, activationRequired: true });

    expect(component.statusChecked()).toBe(true);
    expect(component.activationRequired()).toBe(true);
  });

  it('lets a self-hosted install straight into the wizard', () => {
    const { component, httpMock } = setup();

    flushStatus(httpMock, { setupRequired: true, activationRequired: false });

    expect(component.activationRequired()).toBe(false);
    expect(component.step()).toBe(0);
  });

  it('fails closed when the status call errors', () => {
    const { component, httpMock } = setup();

    httpMock.expectOne(STATUS_URL).error(new ProgressEvent('network'));

    // The route guard already proved setup is open; locking a customer out of a
    // wizard they can retry beats letting a stranger into one they can't undo.
    expect(component.statusChecked()).toBe(true);
    expect(component.activationRequired()).toBe(true);
  });

  it('opens the wizard on a code the server accepts', () => {
    const { component, httpMock } = setup();
    flushStatus(httpMock, { setupRequired: true, activationRequired: true });

    component.activationForm.controls.code.setValue('K7M2-90XF-3TQH');
    component.unlock();

    const req = httpMock.expectOne(VERIFY_URL);
    expect(req.request.body).toEqual({ code: 'K7M2-90XF-3TQH' });
    req.flush({ valid: true });

    expect(component.activationRequired()).toBe(false);
    expect(component.activationChecking()).toBe(false);
    expect(component.step()).toBe(0);
  });

  it('keeps the gate up on a code the server rejects', () => {
    const { component, httpMock } = setup();
    flushStatus(httpMock, { setupRequired: true, activationRequired: true });

    component.activationForm.controls.code.setValue('WRON-GCOD-E123');
    component.unlock();
    httpMock.expectOne(VERIFY_URL).flush({ valid: false });

    expect(component.activationRequired()).toBe(true);
    expect(component.activationChecking()).toBe(false);
  });

  it('keeps the gate up when the check itself fails', () => {
    const { component, httpMock } = setup();
    flushStatus(httpMock, { setupRequired: true, activationRequired: true });

    component.activationForm.controls.code.setValue('K7M2-90XF-3TQH');
    component.unlock();
    httpMock.expectOne(VERIFY_URL).error(new ProgressEvent('network'));

    expect(component.activationRequired()).toBe(true);
    // Left checkable rather than stuck mid-flight — the customer can try again.
    expect(component.activationChecking()).toBe(false);
  });

  it('trims a pasted code before checking it', () => {
    const { component, httpMock } = setup();
    flushStatus(httpMock, { setupRequired: true, activationRequired: true });

    component.activationForm.controls.code.setValue('  K7M2-90XF-3TQH  ');
    component.unlock();

    expect(httpMock.expectOne(VERIFY_URL).request.body).toEqual({ code: 'K7M2-90XF-3TQH' });
  });

  it('does not check an empty code', () => {
    const { component, httpMock } = setup();
    flushStatus(httpMock, { setupRequired: true, activationRequired: true });

    component.unlock();

    httpMock.expectNone(VERIFY_URL);
  });

  it('does not fire a second check while one is in flight', () => {
    const { component, httpMock } = setup();
    flushStatus(httpMock, { setupRequired: true, activationRequired: true });
    component.activationForm.controls.code.setValue('K7M2-90XF-3TQH');

    component.unlock();
    component.unlock();

    // expectOne throws if the double-click queued a second POST.
    httpMock.expectOne(VERIFY_URL).flush({ valid: true });
  });

  it('hands the proven code to the wizard submit', () => {
    // The whole point of the gate: if the code doesn't ride along on the setup
    // POST, the server refuses at the end of a wizard the customer already filled in.
    const { component, httpMock } = setup();
    flushStatus(httpMock, { setupRequired: true, activationRequired: true });

    component.activationForm.controls.code.setValue('K7M2-90XF-3TQH');
    component.unlock();
    httpMock.expectOne(VERIFY_URL).flush({ valid: true });

    component.choosePath('full');
    fillWizard(component);
    component.onSubmit();

    const req = httpMock.expectOne(SETUP_URL);
    expect(req.request.body.activationCode).toBe('K7M2-90XF-3TQH');
  });

  it('sends no code from an ungated install', () => {
    const { component, httpMock } = setup();
    flushStatus(httpMock, { setupRequired: true, activationRequired: false });

    component.choosePath('full');
    fillWizard(component);
    component.onSubmit();

    expect(httpMock.expectOne(SETUP_URL).request.body.activationCode).toBeUndefined();
  });
});

/** Minimum valid account + company input so onSubmit() proceeds. */
function fillWizard(component: SetupInternals): void {
  component.accountForm.setValue({
    firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com',
    password: 'Passw0rd!', confirmPassword: 'Passw0rd!',
  });
  component.companyForm.setValue({
    companyName: 'Example Machining', companyPhone: '', companyEmail: '',
    companyEin: '', companyWebsite: '', locationName: 'Main Office',
    address: { line1: '1 Mill St', city: 'Provo', state: 'UT', postalCode: '84601' },
  });
}

describe('SetupComponent — module bundles', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => localStorage.clear());

  it('keeps the default selection until a bundle is chosen', () => {
    const { component, httpMock } = setup();
    flushStatus(httpMock, { setupRequired: true, activationRequired: false });

    component.choosePath('quick');
    httpMock.expectOne(MODULES_URL).flush(MODULES_RESPONSE);

    expect([...component.selectedModuleIds()]).toEqual(['inventory']);
  });

  it('checks the six job-shop modules when the Job shop chip is clicked', () => {
    const { fixture, httpMock } = render();
    flushStatus(httpMock, { setupRequired: true, activationRequired: false });
    const component = fixture.componentInstance as unknown as SetupInternals;

    component.choosePath('quick');
    httpMock.expectOne(MODULES_URL).flush(MODULES_RESPONSE);
    component.step.set(3);
    fixture.detectChanges();

    const chip = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="setup-bundle-job-shop"]');
    expect(chip?.textContent).toContain('auth.bundleJobShop');
    chip!.click();
    fixture.detectChanges();

    expect([...component.selectedModuleIds()].sort()).toEqual(
      ['inventory', 'invoicing', 'production', 'purchasing', 'sales', 'shipping']);
    expect(chip!.getAttribute('aria-pressed')).toBe('true');
  });

  it('submits the bundle and lands on the dashboard', async () => {
    const { component, httpMock } = setup();
    flushStatus(httpMock, { setupRequired: true, activationRequired: false });
    vi.spyOn(TestBed.inject(LayoutService), 'getDefaultRoute').mockReturnValue('/dashboard');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.choosePath('quick');
    httpMock.expectOne(MODULES_URL).flush(MODULES_RESPONSE);
    (component as unknown as { applyBundle(b: unknown): void }).applyBundle(MODULES_RESPONSE.bundles[0]);
    fillWizard(component);
    component.onSubmit();

    const req = httpMock.expectOne(SETUP_URL);
    expect(req.request.body.selectedModules).toHaveLength(6);
    req.flush({ token: 't', user: {} });
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
