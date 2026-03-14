import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { FileUploadZoneComponent } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { AuthService } from '../../../../shared/services/auth.service';

@Component({
  selector: 'app-account-documents',
  standalone: true,
  imports: [FileUploadZoneComponent],
  templateUrl: './account-documents.component.html',
  styleUrl: './account-documents.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountDocumentsComponent {
  private readonly authService = inject(AuthService);

  protected readonly userId = computed(() => this.authService.user()?.id ?? 0);
}
