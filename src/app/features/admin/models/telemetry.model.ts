/** The agreement shown before remote health monitoring is switched on. */
export interface TelemetryAgreement {
  version: string;
  title: string;
  /** What leaves the building. */
  shared: string[];
  /** What explicitly does not — the part that makes the promise checkable. */
  notShared: string[];
  terms: string[];
  /** A verbatim example of the payload, so "health only" can be verified rather than trusted. */
  samplePayload: string;
}

/** Where this install stands with remote health monitoring. */
export interface TelemetryStatus {
  enabled: boolean;
  /** NotEnrolled / Pending / Accepted / Rejected — Armory Works must accept before anything is sent. */
  enrollmentStatus: string;
  consentVersion: string | null;
  /** 'accepted' | 'declined' | null when never asked. */
  consentDecision: string | null;
  consentAt: string | null;
  consentBy: string | null;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  /** The terms changed since the decision — the operator is asked again rather than carried along. */
  agreementOutOfDate: boolean;
}

/** One decision in the consent history. Declines are kept as carefully as acceptances. */
export interface TelemetryConsentRecord {
  at: string;
  decision: string;
  version: string;
  by: string | null;
  ipAddress: string | null;
}
