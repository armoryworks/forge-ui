import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import { ValidationButtonComponent } from './validation-button.component';

@Component({
  standalone: true,
  imports: [ValidationButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-validation-button [violations]="violations" data-testid="default"><button>Save</button></app-validation-button>
    <app-validation-button [violations]="violations" tooltipPosition="below" data-testid="below"><button>Save</button></app-validation-button>
  `,
})
class HostComponent {
  readonly violations = signal<string[]>(['Name is required', 'GTIN must be 14 digits']);
}

function render(translate?: Partial<TranslateService>) {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: translate ? [{ provide: TranslateService, useValue: translate }] : [],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ValidationButtonComponent trigger labels', () => {
  it('keeps the tooltip above by default and lets a consumer move it', () => {
    const fixture = render();
    const tooltips = fixture.debugElement.queryAll(By.directive(MatTooltip)).map(d => d.injector.get(MatTooltip));

    expect(tooltips.map(t => t.position)).toEqual(['above', 'below']);
  });

  it('falls back to English without a translation service', () => {
    const fixture = render();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('.validation-button__trigger')!;

    expect(trigger.getAttribute('aria-label')).toBe('2 validation issues. Click to view.');
  });

  it('uses the translated label when one exists', () => {
    const fixture = render({
      instant: ((key: string, params?: { count?: number }) =>
        key === 'common.validationIssues' ? `${params?.count} problema(s)` : key) as TranslateService['instant'],
    });
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('.validation-button__trigger')!;

    expect(trigger.getAttribute('aria-label')).toBe('2 problema(s)');
  });
});
