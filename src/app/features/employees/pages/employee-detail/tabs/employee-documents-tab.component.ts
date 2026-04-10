import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { FileUploadZoneComponent } from '../../../../../shared/components/file-upload-zone/file-upload-zone.component';

@Component({
  selector: 'app-employee-documents-tab',
  standalone: true,
  imports: [FileUploadZoneComponent],
  templateUrl: './employee-documents-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeDocumentsTabComponent {
  readonly employeeId = input.required<number>();
}
