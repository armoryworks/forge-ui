import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { AdminService } from './services/admin.service';
import { AdminUser, TrackType, ReferenceDataGroup } from './models/admin.model';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    ReactiveFormsModule, AvatarComponent, PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, ToggleComponent, DataTableComponent,
    ColumnCellDirective, ValidationPopoverDirective,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  private readonly adminService = inject(AdminService);

  protected readonly activeTab = signal<'users' | 'track-types' | 'reference-data'>('users');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  // Users
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly showUserDialog = signal(false);
  protected readonly editingUser = signal<AdminUser | null>(null);

  protected readonly userForm = new FormGroup({
    firstName: new FormControl('', [Validators.required]),
    lastName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
    initials: new FormControl('', [Validators.maxLength(3)]),
    role: new FormControl('Engineer', [Validators.required]),
    isActive: new FormControl(true),
  });
  protected readonly userViolations = FormValidationService.getViolations(this.userForm, {
    firstName: 'First Name', lastName: 'Last Name', email: 'Email',
    password: 'Password', initials: 'Initials', role: 'Role',
  });

  protected readonly avatarColor = signal('#0d9488');

  // Track Types
  protected readonly trackTypes = signal<TrackType[]>([]);
  protected readonly expandedTrackType = signal<number | null>(null);

  // Reference Data
  protected readonly referenceDataGroups = signal<ReferenceDataGroup[]>([]);
  protected readonly expandedGroup = signal<string | null>(null);

  protected readonly userColumns: ColumnDef[] = [
    { field: 'avatar', header: '', width: '36px' },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'email', header: 'Email', sortable: true },
    { field: 'role', header: 'Role', sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'Admin', label: 'Admin' }, { value: 'Engineer', label: 'Engineer' }, { value: 'Viewer', label: 'Viewer' },
    ]},
    { field: 'status', header: 'Status', sortable: true },
    { field: 'actions', header: 'Actions', width: '80px', align: 'right' },
  ];

  protected readonly roleOptions: SelectOption[] = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Engineer', label: 'Engineer' },
    { value: 'Viewer', label: 'Viewer' },
  ];
  protected readonly avatarColors = [
    '#0d9488', '#7c3aed', '#c2410c', '#15803d', '#1d4ed8',
    '#be123c', '#92400e', '#6d28d9', '#065f46', '#1e40af',
  ];

  constructor() {
    this.loadUsers();
  }

  protected switchTab(tab: 'users' | 'track-types' | 'reference-data'): void {
    this.activeTab.set(tab);
    if (tab === 'users' && this.users().length === 0) this.loadUsers();
    if (tab === 'track-types' && this.trackTypes().length === 0) this.loadTrackTypes();
    if (tab === 'reference-data' && this.referenceDataGroups().length === 0) this.loadReferenceData();
  }

  // ── Users ──

  private loadUsers(): void {
    this.loading.set(true);
    this.adminService.getUsers().subscribe({
      next: (users) => { this.users.set(users); this.loading.set(false); },
      error: (err) => { this.error.set('Failed to load users'); this.loading.set(false); },
    });
  }

  protected openCreateUser(): void {
    this.editingUser.set(null);
    this.userForm.reset({
      firstName: '', lastName: '', email: '', password: '',
      initials: '', role: 'Engineer', isActive: true,
    });
    this.userForm.controls.email.enable();
    this.userForm.controls.password.enable();
    this.avatarColor.set('#0d9488');
    this.showUserDialog.set(true);
  }

  protected openEditUser(user: AdminUser): void {
    this.editingUser.set(user);
    this.userForm.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      initials: user.initials ?? '',
      role: user.roles[0] ?? 'Engineer',
      isActive: user.isActive,
    });
    this.userForm.controls.email.disable();
    this.userForm.controls.password.disable();
    this.avatarColor.set(user.avatarColor ?? '#0d9488');
    this.showUserDialog.set(true);
  }

  protected closeUserDialog(): void {
    this.showUserDialog.set(false);
  }

  protected saveUser(): void {
    if (this.userForm.invalid) return;

    const form = this.userForm.getRawValue();
    const editing = this.editingUser();

    this.saving.set(true);

    if (editing) {
      this.adminService.updateUser(editing.id, {
        firstName: form.firstName!,
        lastName: form.lastName!,
        initials: form.initials || undefined,
        avatarColor: this.avatarColor(),
        isActive: form.isActive!,
        role: form.role!,
      }).subscribe({
        next: () => { this.saving.set(false); this.closeUserDialog(); this.loadUsers(); },
        error: (err) => { this.saving.set(false); this.error.set('Failed to update user'); },
      });
    } else {
      this.adminService.createUser({
        email: form.email!,
        firstName: form.firstName!,
        lastName: form.lastName!,
        initials: form.initials || undefined,
        avatarColor: this.avatarColor(),
        password: form.password!,
        role: form.role!,
      }).subscribe({
        next: () => { this.saving.set(false); this.closeUserDialog(); this.loadUsers(); },
        error: (err) => { this.saving.set(false); this.error.set('Failed to create user'); },
      });
    }
  }

  protected toggleUserActive(user: AdminUser): void {
    this.adminService.updateUser(user.id, { isActive: !user.isActive }).subscribe({
      next: () => this.loadUsers(),
      error: () => this.error.set('Failed to update user status'),
    });
  }

  // ── Track Types ──

  private loadTrackTypes(): void {
    this.loading.set(true);
    this.adminService.getTrackTypes().subscribe({
      next: (types) => { this.trackTypes.set(types); this.loading.set(false); },
      error: () => { this.error.set('Failed to load track types'); this.loading.set(false); },
    });
  }

  protected toggleTrackType(id: number): void {
    this.expandedTrackType.set(this.expandedTrackType() === id ? null : id);
  }

  // ── Reference Data ──

  private loadReferenceData(): void {
    this.loading.set(true);
    this.adminService.getReferenceData().subscribe({
      next: (groups) => { this.referenceDataGroups.set(groups); this.loading.set(false); },
      error: () => { this.error.set('Failed to load reference data'); this.loading.set(false); },
    });
  }

  protected toggleGroup(groupCode: string): void {
    this.expandedGroup.set(this.expandedGroup() === groupCode ? null : groupCode);
  }

  protected formatGroupCode(code: string): string {
    return code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}
