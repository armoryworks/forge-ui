import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

import { ControlledDocumentService } from '../../services/controlled-document.service';
import { WorkInstruction } from '../../models/work-instruction.model';
import { CONTROLLED_DOCUMENTS_CAPABILITY } from '../../models/controlled-document-roles.model';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { FileDownloadService } from '../../../../shared/services/file-download.service';

/** The current approved work instructions for a routing operation, as buttons that open the document. Renders nothing when there are none. */
@Component({
  selector: 'app-work-instructions',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './work-instructions.component.html',
  styleUrl: './work-instructions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkInstructionsComponent {
  private readonly documentService = inject(ControlledDocumentService);
  private readonly capabilities = inject(CapabilityService);
  private readonly fileDownload = inject(FileDownloadService);
  private readonly destroyRef = inject(DestroyRef);

  readonly operationId = input<number | null>(null);

  protected readonly enabled = computed(() => this.capabilities.isEnabled(CONTROLLED_DOCUMENTS_CAPABILITY));
  protected readonly instructions = signal<WorkInstruction[]>([]);

  constructor() {
    effect(() => {
      const operationId = this.operationId();
      this.instructions.set([]);
      if (!operationId || !this.enabled()) return;
      this.documentService.workInstructions(operationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: list => this.instructions.set(list),
      });
    });
  }

  protected open(instruction: WorkInstruction): void {
    this.fileDownload.openOrDownload(
      this.documentService.fileDownloadUrl(instruction.fileAttachmentId), instruction.fileName, instruction.contentType);
  }
}
