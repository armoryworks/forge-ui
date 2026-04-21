import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ChatService } from '../../services/chat.service';

export interface ShareEntityDialogData {
  entityType: string;
  entityId: number;
  displayText: string;
}

const ENTITY_ICONS: Record<string, string> = {
  job: 'work',
  part: 'build',
  event: 'event',
  asset: 'precision_manufacturing',
  lead: 'person_search',
  invoice: 'receipt',
  quote: 'request_quote',
  vendor: 'storefront',
  'sales-order': 'shopping_cart',
  'purchase-order': 'local_shipping',
  shipment: 'local_shipping',
  payment: 'payments',
  customer: 'business',
  training: 'school',
  lot: 'inventory',
};

@Component({
  selector: 'app-share-entity-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    SelectComponent,
    TextareaComponent,
    ValidationButtonComponent,
    TranslatePipe,
  ],
  templateUrl: './share-entity-dialog.component.html',
  styleUrl: './share-entity-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareEntityDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ShareEntityDialogComponent>);
  private readonly chatService = inject(ChatService);
  private readonly snackbar = inject(SnackbarService);
  readonly data = inject<ShareEntityDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly channelOptions = signal<SelectOption[]>([]);

  protected readonly form = new FormGroup({
    channelId: new FormControl<number | null>(null, [Validators.required]),
    message: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    channelId: 'Channel',
  });

  protected readonly entityIcon = ENTITY_ICONS[this.data.entityType] ?? 'link';

  ngOnInit(): void {
    this.loadChannels();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    const { channelId, message } = this.form.getRawValue();
    const mention = `@[${this.data.entityType}:${this.data.entityId}:${this.data.displayText}]`;
    const content = message ? `${message}\n${mention}` : mention;

    this.chatService.sendChatRoomMessage(channelId!, content).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success('chat.entityShared');
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private loadChannels(): void {
    this.chatService.getChannels().subscribe(channels => {
      const options: SelectOption[] = channels.map(ch => ({
        value: ch.id,
        label: ch.name,
      }));
      this.channelOptions.set(options);
    });

    this.chatService.getConversations().subscribe(convs => {
      const dmOptions: SelectOption[] = convs.map(c => ({
        value: -c.userId,
        label: c.userName,
      }));
      this.channelOptions.update(opts => [...opts, ...dmOptions]);
    });
  }
}
