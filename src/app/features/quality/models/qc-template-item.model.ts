export interface QcTemplateItem {
  id: number;
  description: string;
  specification: string | null;
  sortOrder: number;
  isRequired: boolean;
}
