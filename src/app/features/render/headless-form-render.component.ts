import { ChangeDetectionStrategy, Component, signal, OnInit, OnDestroy } from '@angular/core';

import { ComplianceFormRendererComponent } from '../account/components/compliance-form-renderer/compliance-form-renderer.component';
import { ComplianceFormDefinition } from '../../shared/models/compliance-form-definition.model';

/* eslint-disable @typescript-eslint/no-explicit-any */
const win = window as any;

/**
 * Headless form render route for PuppeteerSharp visual comparison.
 * No auth, no layout chrome — just the compliance form renderer.
 *
 * PuppeteerSharp workflow:
 * 1. Navigate to /__render-form
 * 2. Inject definition via: window.__FORM_DEFINITION__ = <json>; window.dispatchEvent(new Event('formDefinitionReady'))
 * 3. Wait for window.__RENDER_READY__ === true
 * 4. Read window.__PAGE_COUNT__ for multi-page forms
 * 5. Call window.__switchPage__(index) to navigate pages
 * 6. Screenshot the .headless-render__container element
 */
@Component({
  selector: 'app-headless-form-render',
  standalone: true,
  imports: [ComplianceFormRendererComponent],
  templateUrl: './headless-form-render.component.html',
  styleUrl: './headless-form-render.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeadlessFormRenderComponent implements OnInit, OnDestroy {
  protected readonly definition = signal<ComplianceFormDefinition | null>(null);

  private onDefinitionReady = () => this.loadDefinition();

  ngOnInit(): void {
    // Check if definition was already set before component loaded
    const existing = win['__FORM_DEFINITION__'];
    if (existing) {
      this.setDefinition(existing);
    }

    // Listen for definition injection from PuppeteerSharp
    window.addEventListener('formDefinitionReady', this.onDefinitionReady);

    // Expose page switching function for PuppeteerSharp
    win['__switchPage__'] = (index: number) => {
      this.switchPage(index);
    };
  }

  ngOnDestroy(): void {
    window.removeEventListener('formDefinitionReady', this.onDefinitionReady);
    delete win['__switchPage__'];
    delete win['__RENDER_READY__'];
    delete win['__PAGE_COUNT__'];
  }

  private loadDefinition(): void {
    const raw = win['__FORM_DEFINITION__'];
    if (raw) {
      this.setDefinition(raw);
    }
  }

  private setDefinition(raw: unknown): void {
    const def = typeof raw === 'string' ? JSON.parse(raw) as ComplianceFormDefinition : raw as ComplianceFormDefinition;
    this.definition.set(def);

    // Signal readiness after a render cycle
    requestAnimationFrame(() => {
      setTimeout(() => {
        const pages = def.pages ?? [{ id: 'main', title: 'Main', sections: def.sections ?? [] }];
        win['__PAGE_COUNT__'] = pages.length;
        win['__RENDER_READY__'] = true;
      }, 500);
    });
  }

  private switchPage(index: number): void {
    // Access the renderer's page switching via DOM query
    const rendererEl = document.querySelector('app-compliance-form-renderer');
    if (!rendererEl) return;

    // Find the tab buttons and click the target one
    const tabs = rendererEl.querySelectorAll('.compliance-form__tab');
    if (tabs[index]) {
      (tabs[index] as HTMLElement).click();
    }
  }
}
