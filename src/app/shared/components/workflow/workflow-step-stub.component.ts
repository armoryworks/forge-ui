import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Workflow Pattern Phase 4 — Generic step placeholder.
 *
 * Mounted by the shell when `WorkflowStepRegistryService` doesn't have a
 * concrete component for the step's `componentName`. This is the expected
 * shape during Phase 4 (shell ships, per-entity steps are Phase 5+) so the
 * shell can be demonstrated end-to-end without per-entity code.
 *
 * Per-entity step components implement the same input contract:
 *   • `stepId` — the step definition id
 *   • `entityId` — the bound entity row's id
 *   • `entity` — the loaded entity payload (typed per feature)
 *
 * The stub displays which step it's standing in for so designers can
 * verify the shell layout without per-step polish.
 */
@Component({
  selector: 'app-workflow-step-stub',
  standalone: true,
  template: `
    <section class="workflow-step-stub" data-testid="workflow-step-stub">
      <h2 class="workflow-step-stub__heading">Step: {{ stepId() }}</h2>
      <p class="workflow-step-stub__hint">
        Placeholder content for component
        <code>{{ componentName() || 'Unknown' }}</code>.
        Phase 5 wires the real per-entity step UI here.
      </p>
      @if (entityId()) {
        <p class="workflow-step-stub__meta">Entity #{{ entityId() }}</p>
      }
    </section>
  `,
  styles: [`
    .workflow-step-stub {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 24px;
      border: 2px dashed var(--border);
      background: var(--surface);
    }
    .workflow-step-stub__heading {
      margin: 0;
      font-size: 16px;
      color: var(--text);
    }
    .workflow-step-stub__hint {
      margin: 0;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .workflow-step-stub__meta {
      margin: 0;
      font-size: 11px;
      color: var(--text-muted);
    }
    code {
      background: var(--bg);
      padding: 1px 4px;
      font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowStepStubComponent {
  readonly stepId = input<string>('');
  readonly componentName = input<string>('');
  readonly entityId = input<number | null>(null);
}
