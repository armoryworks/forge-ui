import { FormGroup } from '@angular/forms';

export interface DraftableForm {
  entityType: string;
  entityId: string;
  displayLabel: string;
  route: string;
  form: FormGroup;
  isDirty(): boolean;
  getFormSnapshot(): Record<string, unknown>;
  restoreDraft(data: Record<string, unknown>): void;
}
