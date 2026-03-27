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
  category: 'service' | 'shipping' | 'accounting';
  sandboxSteps: string[] | null;
  sandboxUrl: string | null;
  logoUrl: string | null;
}

export interface IntegrationSettingsResult {
  showSandboxGuides: boolean;
  integrations: IntegrationStatus[];
}

export interface TestIntegrationResult {
  success: boolean;
  message: string;
}
