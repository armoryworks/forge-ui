import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SettingsCatalogEntry } from './models/setting-entry.model';
import { AdminSettingsService } from './services/admin-settings.service';
import { SettingFieldComponent } from './setting-field/setting-field.component';

/**
 * Phase 1m — admin settings page. Two-column layout: left rail with
 * group navigation, right pane with the per-group editor (one field
 * per descriptor). Selected group syncs to the URL —
 * `/admin/configuration` (no group → first one auto-selected) or
 * `/admin/configuration/{group}`.
 *
 * Save semantics: per-field, on-blur. Touching a field then leaving
 * (tab away or click another field) commits the new value. Empty
 * value erases the row → the descriptor's DefaultValue applies on the
 * next read. This matches the rest of the admin surfaces (terminology,
 * working calendars) — no global "Save" button to forget.
 */
@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [
    RouterLink, RouterLinkActive, TranslatePipe,
    LoadingBlockDirective,
    SettingFieldComponent,
  ],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsComponent implements OnInit {
  private readonly service = inject(AdminSettingsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly groups = this.service.groups;
  protected readonly entries = this.service.entries;
  protected readonly loading = this.service.loading;

  protected readonly groupParam = toSignal(
    this.route.paramMap.pipe(map(p => p.get('group'))),
    { initialValue: null },
  );

  protected readonly activeGroup = computed(() => {
    const requested = this.groupParam();
    if (requested) return requested;
    const first = this.groups()[0];
    return first ?? null;
  });

  constructor() {
    // Auto-redirect to the first group when the bare /admin/configuration
    // URL is hit (no :group param). Keeps the URL in sync with what
    // the user is actually viewing.
    effect(() => {
      const requested = this.groupParam();
      const groups = this.groups();
      if (!requested && groups.length > 0) {
        this.router.navigate(['/admin/configuration', groups[0]], { replaceUrl: true });
      }
    });

    // Reload entries whenever the active group changes.
    effect(() => {
      const group = this.activeGroup();
      if (group) this.service.loadGroup(group);
    });
  }

  ngOnInit(): void {
    this.service.loadGroups();
  }

  protected onFieldSave(entry: SettingsCatalogEntry, value: string | null): void {
    this.service.updateSetting(entry.key, value).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('admin.settings.saved', { name: entry.displayName }));
        // Refresh so secret masking + hasValue indicator reflect the save.
        const group = this.activeGroup();
        if (group) this.service.loadGroup(group);
      },
      error: (err) => {
        const detail = (err.error?.detail as string | undefined)
          ?? this.translate.instant('admin.settings.saveFailed');
        this.toast.show({
          severity: 'error',
          title: this.translate.instant('admin.settings.saveFailedTitle', { name: entry.displayName }),
          message: detail,
        });
      },
    });
  }

  protected groupSlug(group: string): string {
    return group;
  }
}
