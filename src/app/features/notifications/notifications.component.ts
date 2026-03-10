import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { toSignal } from '@angular/core/rxjs-interop';

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
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly prefs = inject(UserPreferencesService);

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
    { field: 'title', header: 'Title', sortable: true },
    { field: 'message', header: 'Message', sortable: true },
    { field: 'severity', header: 'Severity', sortable: true, filterable: true, type: 'enum',
      filterOptions: [
        { value: 'info', label: 'Info' },
        { value: 'warning', label: 'Warning' },
        { value: 'critical', label: 'Critical' },
      ] },
    { field: 'source', header: 'Source', sortable: true },
    { field: 'createdAt', header: 'Date', sortable: true, type: 'date', width: '150px' },
  ];

  readonly severityOptions: SelectOption[] = [
    { value: null, label: '-- All --' },
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'critical', label: 'Critical' },
  ];

  readonly sourceOptions: SelectOption[] = [
    { value: null, label: '-- All --' },
    { value: 'system', label: 'System' },
    { value: 'board', label: 'Board' },
    { value: 'timer', label: 'Timer' },
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
