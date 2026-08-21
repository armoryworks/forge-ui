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

export type IntegrationReadiness = 'NotNeeded' | 'Configured' | 'Mock' | 'Gap' | 'Optional';

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
  /** Capability whose being ON makes this integration needed. Null = infrastructure. */
  capabilityCode?: string | null;
  /** Whether that gating capability is enabled (true when there is none). */
  capabilityEnabled?: boolean;
  /** Readiness verdict; 'Gap' is the actionable state (cap on, unconfigured, in prod). */
  readiness?: IntegrationReadiness;
}

export interface IntegrationSettingsResult {
  showSandboxGuides: boolean;
  integrations: IntegrationStatus[];
  /** Production posture — a production env not globally forced to mock. */
  productionPosture?: boolean;
  /** MockIntegrations=true while running Production — a misconfiguration to warn about. */
  mockIntegrationsInProduction?: boolean;
  /** Count of integrations in the 'Gap' state. */
  gapCount?: number;
}

export interface TestIntegrationResult {
  success: boolean;
  message: string;
}
