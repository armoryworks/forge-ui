import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { FileUploadZoneComponent } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { FileAttachment } from '../../../../shared/models/file.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { downloadBlob } from '../../../../shared/utils/download-blob';
import { AccountService } from '../../services/account.service';

@Component({
  selector: 'app-account-documents',
  standalone: true,
  imports: [DatePipe, MatTooltipModule, FileUploadZoneComponent, TranslatePipe],
  templateUrl: './account-documents.component.html',
  styleUrl: './account-documents.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountDocumentsComponent {
  private readonly authService = inject(AuthService);
  private readonly accountService = inject(AccountService);

  protected readonly userId = computed(() => this.authService.user()?.id ?? 0);
  protected readonly documents = signal<FileAttachment[]>([]);

  constructor() {
    effect(() => {
      if (this.userId()) this.loadDocuments();
    });
  }

  protected loadDocuments(): void {
    const userId = this.userId();
    if (!userId) return;
    this.accountService.getMyDocuments(userId).subscribe(docs => this.documents.set(docs));
  }

  protected download(doc: FileAttachment): void {
    this.accountService.downloadDocument(doc.id).subscribe(blob => downloadBlob(blob, doc.fileName));
  }
}
