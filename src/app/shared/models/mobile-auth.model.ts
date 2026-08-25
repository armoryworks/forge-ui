import { AuthUser } from '../services/auth.service';

export interface MobileAuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  deviceId: number;
  deviceName: string;
  user: AuthUser;
}

/** The JSON carried by the admin-issued enrollment QR. */
export interface EnrollmentQrPayload {
  server: string;
  token: string;
  name: string;
  certSha256: string | null;
  shared?: boolean;
}

export interface SharedDeviceEnrollResponse {
  deviceId: number;
  deviceName: string;
  deviceToken: string;
  instanceName: string;
}

/** /.well-known/forge.json — instance discovery for the manual path. */
export interface ForgeWellKnown {
  api: string;
  name: string;
  auth: string[];
  cert_sha256: string | null;
  min_app_version: string;
}
