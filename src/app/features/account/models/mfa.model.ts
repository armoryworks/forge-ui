export type MfaDeviceType = 'Totp' | 'Sms' | 'Email' | 'WebAuthn';

export interface MfaSetupResponse {
  secret: string;
  qrCodeUri: string;
  manualEntryKey: string;
  deviceId: number;
}

export interface MfaChallengeResponse {
  challengeToken: string;
  deviceType: MfaDeviceType;
  maskedTarget: string | null;
}

export interface MfaValidateRequest {
  challengeToken: string;
  code: string;
  rememberDevice: boolean;
}

export interface MfaValidateResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface MfaStatus {
  isEnabled: boolean;
  isEnforcedByPolicy: boolean;
  devices: MfaDeviceSummary[];
  recoveryCodesRemaining: number;
}

export interface MfaDeviceSummary {
  id: number;
  deviceType: MfaDeviceType;
  deviceName: string | null;
  isDefault: boolean;
  isVerified: boolean;
  lastUsedAt: string | null;
}

export interface MfaRecoveryCodesResponse {
  codes: string[];
  warning: string;
}

export interface MfaComplianceUser {
  userId: number;
  fullName: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  mfaDeviceType: MfaDeviceType | null;
  isEnforcedByPolicy: boolean;
}
