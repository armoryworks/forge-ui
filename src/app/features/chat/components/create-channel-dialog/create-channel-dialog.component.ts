import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { ChatService } from '../../services/chat.service';
import { ChannelType, ChatRoom } from '../../models/chat-room.model';

interface UserListItem {
  id: number;
  initials: string;
  name: string;
  color: string;
}

@Component({
  selector: 'app-create-channel-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    ValidationPopoverDirective,
    AvatarComponent,
    TranslatePipe,
  ],
  templateUrl: './create-channel-dialog.component.html',
  styleUrl: './create-channel-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateChannelDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateChannelDialogComponent>);
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);

  protected readonly saving = signal(false);
  protected readonly allUsers = signal<UserListItem[]>([]);
  protected readonly selectedMembers = signal<UserListItem[]>([]);
  protected readonly memberSearchControl = new FormControl('');
  protected readonly memberSearchTerm = signal('');

  protected readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    channelType: new FormControl<ChannelType>('Group', [Validators.required]),
    description: new FormControl('', [Validators.maxLength(500)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Channel Name',
    channelType: 'Channel Type',
  });

  protected readonly channelTypeOptions: SelectOption[] = [
    { value: 'Group', label: 'Private Group' },
    { value: 'Custom', label: 'Public Channel' },
  ];

  protected readonly filteredUsers = signal<UserListItem[]>([]);

  constructor() {
    this.http.get<UserListItem[]>('/api/v1/users').subscribe(users => {
      this.allUsers.set(users);
      this.updateFilteredUsers();
    });

    this.memberSearchControl.valueChanges.subscribe(v => {
      this.memberSearchTerm.set(v ?? '');
      this.updateFilteredUsers();
    });
  }

  protected addMember(user: UserListItem): void {
    this.selectedMembers.update(m => [...m, user]);
    this.memberSearchControl.setValue('');
    this.updateFilteredUsers();
  }

  protected removeMember(userId: number): void {
    this.selectedMembers.update(m => m.filter(u => u.id !== userId));
    this.updateFilteredUsers();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    const { name, channelType, description } = this.form.getRawValue();

    this.chatService.createChannel({
      name: name!,
      channelType: channelType!,
      description: description || undefined,
      memberIds: this.selectedMembers().map(m => m.id),
    }).subscribe({
      next: (channel: ChatRoom) => {
        this.saving.set(false);
        this.dialogRef.close(channel);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private updateFilteredUsers(): void {
    const term = this.memberSearchTerm().toLowerCase();
    const currentUserId = this.authService.user()?.id;
    const selectedIds = new Set(this.selectedMembers().map(m => m.id));

    this.filteredUsers.set(
      this.allUsers()
        .filter(u => u.id !== currentUserId)
        .filter(u => !selectedIds.has(u.id))
        .filter(u => !term || u.name.toLowerCase().includes(term)),
    );
  }
}
