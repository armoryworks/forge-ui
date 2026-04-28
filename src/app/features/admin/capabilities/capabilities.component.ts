import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { SnackbarService } from '../../../shared/services/snackbar.service';
import { CapabilityService } from '../../../shared/services/capability.service';
import { CapabilityDescriptorEntry } from '../../../shared/models/capability-descriptor.model';

interface CapabilityViolation {
  code: string;
  message: string;
  capability?: string;
  dependents?: string[];
  missing?: string[];
  conflicts?: string[];
}

/**
 * Phase 4 Phase-C — Minimum viable admin capabilities page. Lazy-loaded at
 * `/admin/capabilities`. Lists every capability with a toggle switch; invokes
 * `CapabilityService.setEnabled` and surfaces 409 / 412 envelopes as
 * informative snackbar messages.
 *
 * Phase E will replace this with the full Browse / History / Detail UI
 * (filtering, search, area accordion, audit-log drill-down). Phase C scope:
 * the toggle UX, ETag plumbing, and structural validation that the API
 * surface works end-to-end.
 *
 * Per 4E-decisions-log #5 (pessimistic UX): the toggle shows a pending state
 * until the server confirms.
 */
@Component({
  selector: 'app-capabilities',
  standalone: true,
  imports: [CommonModule, MatSlideToggleModule],
  templateUrl: './capabilities.component.html',
  styleUrl: './capabilities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapabilitiesComponent implements OnInit {
  private readonly capabilityService = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = this.capabilityService.loading;
  protected readonly capabilities = this.capabilityService.capabilities;

  protected readonly enabledCount = computed(() => this.capabilities().filter((c) => c.enabled).length);

  /** Phase 4 Phase-C — set of codes currently being toggled (pessimistic UX). */
  protected readonly pending = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.capabilityService.load();
  }

  protected refresh(): void {
    this.capabilityService.load();
  }

  /** Phase 4 Phase-C — pessimistic toggle: disable until server confirms. */
  protected onToggle(entry: CapabilityDescriptorEntry, target: boolean): void {
    if (this.pending().has(entry.code)) return;
    this.markPending(entry.code, true);

    this.capabilityService.setEnabled(entry.code, target).subscribe({
      next: () => {
        this.snackbar.success(`Capability ${target ? 'enabled' : 'disabled'}: ${entry.name}`);
        this.markPending(entry.code, false);
      },
      error: (err: HttpErrorResponse) => {
        this.markPending(entry.code, false);
        this.surfaceError(entry, err);
        // Refresh so the local snapshot's ETag/state reflect server truth.
        this.capabilityService.load();
      },
    });
  }

  protected isPending(code: string): boolean {
    return this.pending().has(code);
  }

  private markPending(code: string, on: boolean): void {
    const current = new Set(this.pending());
    if (on) current.add(code);
    else current.delete(code);
    this.pending.set(current);
  }

  private surfaceError(entry: CapabilityDescriptorEntry, err: HttpErrorResponse): void {
    const violation = this.extractFirstViolation(err);
    if (!violation) {
      this.snackbar.error(`Failed to update ${entry.name}.`);
      return;
    }
    switch (violation.code) {
      case 'capability-has-dependents':
        this.snackbar.error(
          `Cannot disable ${entry.name} — disable these dependents first: ${(violation.dependents ?? []).join(', ')}.`,
        );
        break;
      case 'capability-missing-dependencies':
        this.snackbar.error(
          `Cannot enable ${entry.name} — enable these dependencies first: ${(violation.missing ?? []).join(', ')}.`,
        );
        break;
      case 'capability-mutex-violation':
        this.snackbar.error(
          `${entry.name} conflicts with: ${(violation.conflicts ?? []).join(', ')}. Disable the peer first.`,
        );
        break;
      case 'version-mismatch':
        this.snackbar.error(
          `${entry.name} was modified by another admin. The page has been refreshed; try again.`,
        );
        break;
      default:
        this.snackbar.error(violation.message ?? `Failed to update ${entry.name}.`);
        break;
    }
  }

  private extractFirstViolation(err: HttpErrorResponse): CapabilityViolation | null {
    const body = err.error;
    if (!body || typeof body !== 'object') return null;
    if (!Array.isArray(body.errors) || body.errors.length === 0) return null;
    return body.errors[0] as CapabilityViolation;
  }
}
