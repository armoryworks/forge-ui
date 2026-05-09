/**
 * Wave 8 phase 1h — IMAP-specific connect request shape. Server-side
 * the password is encrypted via Data Protection API en route to the
 * sealed envelope; the client posts plaintext over HTTPS exactly once.
 */
export interface ImapConnectRequest {
  host: string;
  port: number;
  useSsl: boolean;
  username: string;
  password: string;
  mailbox: string | null;
  displayLabel: string | null;
}

/**
 * Static catalog of the most-common IMAP providers. The connect dialog
 * surfaces these as radio cards so the user doesn't have to remember
 * Gmail's host/port. "Custom" hands them a free-form set of fields.
 */
export interface ImapPreset {
  id: string;
  displayName: string;
  host: string;
  port: number;
  useSsl: boolean;
  /** Hint shown under the preset card (e.g. "App Password required"). */
  hint?: string;
}

export const IMAP_PRESETS: readonly ImapPreset[] = [
  {
    id: 'gmail',
    displayName: 'Gmail / Google Workspace',
    host: 'imap.gmail.com',
    port: 993,
    useSsl: true,
    hint: 'Requires an App Password (2FA must be enabled).',
  },
  {
    id: 'outlook',
    displayName: 'Outlook / Office 365',
    host: 'outlook.office365.com',
    port: 993,
    useSsl: true,
    hint: 'Requires an App Password if MFA is on.',
  },
  {
    id: 'yahoo',
    displayName: 'Yahoo Mail',
    host: 'imap.mail.yahoo.com',
    port: 993,
    useSsl: true,
    hint: 'Requires an App Password.',
  },
  {
    id: 'fastmail',
    displayName: 'Fastmail',
    host: 'imap.fastmail.com',
    port: 993,
    useSsl: true,
  },
  {
    id: 'icloud',
    displayName: 'iCloud Mail',
    host: 'imap.mail.me.com',
    port: 993,
    useSsl: true,
    hint: 'Requires an App-specific Password.',
  },
  {
    id: 'custom',
    displayName: 'Custom / Self-hosted',
    host: '',
    port: 993,
    useSsl: true,
  },
];
