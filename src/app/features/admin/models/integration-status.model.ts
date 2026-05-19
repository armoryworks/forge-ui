export interface IntegrationSettingChoice {
  value: string;
  label: string;
}

export interface IntegrationSettingField {
  key: string;
  label: string;
  value: string;
  isSensitive: boolean;
  isRequired: boolean;
  inputType: 'text' | 'password' | 'number' | 'email' | 'toggle' | 'enum' | 'url' | 'textarea';
  /** Non-null only when inputType === 'enum' — rendered as a select dropdown. */
  choices?: IntegrationSettingChoice[] | null;
  /** Optional helper text shown beneath the field. */
  description?: string | null;
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
