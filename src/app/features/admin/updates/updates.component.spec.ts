import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';

import { UpdatesComponent } from './updates.component';
import { UpdatesService } from './services/updates.service';
import { DeployJob, DeployState } from './models/update.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      adminUpdates: {
        unreachable: 'Forge did not answer',
        noAgent: { title: 'No agent', body: 'none' },
        states: { running: 'running', succeeded: 'done', failed: 'failed' },
      },
    });
  }
}

const job = (overrides: Partial<DeployJob>): DeployJob => ({
  id: 'j1', action: 'update', service: null, tag: null, state: 'running', exitCode: null,
  startedAt: '2026-10-18T10:00:00Z', endedAt: null, needsApproval: null, reason: null,
  partial: null, steps: [{ box: 'local', state: 'running', exitCode: null, reason: null }], logSize: 0,
  ...overrides,
});

const agentState: DeployState = { agentAvailable: true, agentVersion: '1', tiers: [], runningJob: null };

function setup(getState: () => Observable<DeployState>) {
  TestBed.configureTestingModule({
    imports: [UpdatesComponent],
    providers: [
      {
        provide: UpdatesService,
        useValue: {
          getState,
          getAvailability: () => of({ status: 'current', newestRelease: null, message: null }),
          getJob: () => of(job({})),
          getJobLog: () => of(''),
          startJob: () => of(job({})),
        },
      },
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader }, fallbackLang: 'en', lang: 'en' }),
    ],
  });
  const fixture = TestBed.createComponent(UpdatesComponent);
  fixture.detectChanges();
  return fixture;
}

describe('UpdatesComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('says a single-box job finished once it succeeded', () => {
    const fixture = setup(() => of(agentState));
    (fixture.componentInstance as unknown as { job: { set: (j: DeployJob) => void } }).job.set(
      job({ state: 'succeeded', exitCode: 0, endedAt: '2026-10-18T10:05:00Z', steps: [{ box: 'local', state: 'succeeded', exitCode: 0, reason: null }] }));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="updates-steps"]')).toBeNull();
    expect(el.querySelector('[data-testid="updates-outcome"]')?.textContent).toContain('done');
  });

  it('shows the failure reason on a failed job', () => {
    const fixture = setup(() => of(agentState));
    (fixture.componentInstance as unknown as { job: { set: (j: DeployJob) => void } }).job.set(
      job({ state: 'failed', exitCode: 3, endedAt: '2026-10-18T10:05:00Z', reason: 'health check failed' }));
    fixture.detectChanges();

    const outcome = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="updates-outcome"]')?.textContent ?? '';
    expect(outcome).toContain('failed');
    expect(outcome).toContain('health check failed');
  });

  it('says the API did not answer when the first state load fails', () => {
    const fixture = setup(() => throwError(() => ({ status: 504 })));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="updates-unreachable"]')?.textContent).toContain('Forge did not answer');
    expect(el.querySelector('[data-testid="updates-no-agent"]')).toBeNull();
  });

  it('shows no unreachable notice once state has loaded', () => {
    const fixture = setup(() => of(agentState));
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="updates-unreachable"]')).toBeNull();
  });
});
