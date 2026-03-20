export interface IntegrationSettingField {
  key: string;
  label: string;
  value: string;
  isSensitive: boolean;
  isRequired: boolean;
  inputType: 'text' | 'password' | 'number' | 'email' | 'toggle';
}

export interface IntegrationStatus {
  provider: string;
  name: string;
  description: string;
  icon: string;
  isConfigured: boolean;
  fields: IntegrationSettingField[];
}

export interface TestIntegrationResult {
  success: boolean;
  message: string;
}
