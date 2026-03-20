import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { ToolbarComponent } from '../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../shared/directives/spacer.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { SelectOption } from '../../shared/components/select/select.component';
import { NotificationService } from '../../shared/services/notification.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    SelectComponent,
    InputComponent,
    ToolbarComponent,
    SpacerDirective,
    TranslatePipe,
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly prefs = inject(UserPreferencesService);
  private readonly translate = inject(TranslateService);

  readonly searchControl = new FormControl('');
  readonly severityControl = new FormControl<string | null>(null);
  readonly sourceControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges, { initialValue: '' });
  private readonly severityFilter = toSignal(this.severityControl.valueChanges, { initialValue: null });
  private readonly sourceFilter = toSignal(this.sourceControl.valueChanges, { initialValue: null });

  readonly activeTab = signal<'all' | 'preferences'>('all');

  readonly notifications = this.notificationService.filteredNotifications;

  readonly filteredNotifications = computed(() => {
    let items = this.notifications();
    const search = this.searchTerm()?.toLowerCase() ?? '';
    const severity = this.severityFilter();
    const source = this.sourceFilter();

    if (search) {
      items = items.filter(n =>
        n.title.toLowerCase().includes(search) ||
        n.message.toLowerCase().includes(search));
    }
    if (severity) {
      items = items.filter(n => n.severity === severity);
    }
    if (source) {
      items = items.filter(n => n.source === source);
    }
    return items;
  });

  readonly notificationColumns: ColumnDef[] = [
    { field: 'title', header: this.translate.instant('common.title'), sortable: true },
    { field: 'message', header: this.translate.instant('notifications.message'), sortable: true },
    { field: 'severity', header: this.translate.instant('notifications.severity'), sortable: true, filterable: true, type: 'enum',
      filterOptions: [
        { value: 'info', label: this.translate.instant('notifications.severityInfo') },
        { value: 'warning', label: this.translate.instant('notifications.severityWarning') },
        { value: 'critical', label: this.translate.instant('notifications.severityCritical') },
      ] },
    { field: 'source', header: this.translate.instant('notifications.source'), sortable: true },
    { field: 'createdAt', header: this.translate.instant('common.date'), sortable: true, type: 'date', width: '150px' },
  ];

  readonly severityOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('notifications.allFilter') },
    { value: 'info', label: this.translate.instant('notifications.severityInfo') },
    { value: 'warning', label: this.translate.instant('notifications.severityWarning') },
    { value: 'critical', label: this.translate.instant('notifications.severityCritical') },
  ];

  readonly sourceOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('notifications.allFilter') },
    { value: 'system', label: this.translate.instant('notifications.sourceSystem') },
    { value: 'board', label: this.translate.instant('notifications.sourceBoard') },
    { value: 'timer', label: this.translate.instant('notifications.sourceTimer') },
  ];

  // Notification preference toggles
  readonly emailOnCritical = signal(this.prefs.get<boolean>('notif:email_critical') ?? true);
  readonly emailOnAssignment = signal(this.prefs.get<boolean>('notif:email_assignment') ?? true);
  readonly emailOnMention = signal(this.prefs.get<boolean>('notif:email_mention') ?? true);
  readonly soundEnabled = signal(this.prefs.get<boolean>('notif:sound') ?? true);

  setTab(tab: 'all' | 'preferences'): void {
    this.activeTab.set(tab);
  }

  markAllRead(): void {
    this.notificationService.markAllRead();
  }

  dismissAll(): void {
    this.notificationService.dismissAll();
  }

  togglePref(key: string, current: boolean): void {
    const newVal = !current;
    this.prefs.set(`notif:${key}`, newVal);

    switch (key) {
      case 'email_critical': this.emailOnCritical.set(newVal); break;
      case 'email_assignment': this.emailOnAssignment.set(newVal); break;
      case 'email_mention': this.emailOnMention.set(newVal); break;
      case 'sound': this.soundEnabled.set(newVal); break;
    }
  }
}
