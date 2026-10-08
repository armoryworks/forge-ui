export interface SystemSettingDefinition {
  key: string;
  labelKey: string;
  descKey: string;
  type: 'text' | 'number' | 'boolean' | 'priority' | 'color';
}
