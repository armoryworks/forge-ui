export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'toggle';
  isRequired: boolean;
  options: string[] | null;
}
