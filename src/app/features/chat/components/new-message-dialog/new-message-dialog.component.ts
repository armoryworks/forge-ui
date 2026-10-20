import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { matchesSearch } from '../../../../shared/utils/fold-for-search';

export interface NewMessageRecipient {
  id: number;
  initials: string;
  name: string;
  color: string;
}

@Component({
  selector: 'app-new-message-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, AvatarComponent, DialogComponent, InputComponent],
  templateUrl: './new-message-dialog.component.html',
  styleUrl: './new-message-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewMessageDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewMessageDialogComponent, NewMessageRecipient>);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly searchControl = new FormControl('');
  private readonly searchTerm = toSignal(this.searchControl.valueChanges, { initialValue: '' });

  protected readonly loading = signal(true);
  protected readonly unavailable = signal(false);
  private readonly users = signal<NewMessageRecipient[]>([]);

  protected readonly filteredUsers = computed(() => {
    const currentUserId = this.authService.user()?.id;
    const term = this.searchTerm();
    return this.users().filter(u => u.id !== currentUserId && matchesSearch(u.name, term));
  });

  constructor() {
    this.http.get<NewMessageRecipient[]>('/api/v1/users').pipe(
      catchError(() => {
        this.unavailable.set(true);
        return of([] as NewMessageRecipient[]);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(users => {
      this.users.set(users);
      this.loading.set(false);
    });
  }

  protected select(user: NewMessageRecipient): void {
    this.dialogRef.close(user);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
