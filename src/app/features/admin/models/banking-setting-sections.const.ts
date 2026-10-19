import { BankingSettingSection } from './banking-setting-section.model';

const field = (key: string, name: string, choices?: string[]) => ({
  key,
  labelKey: `adminBanking.fields.${name}`,
  hintKey: `adminBanking.fields.${name}Hint`,
  ...(choices ? { choices } : {}),
});

export const BANKING_SETTING_SECTIONS: BankingSettingSection[] = [
  {
    id: 'wires',
    titleKey: 'adminBanking.sections.wires',
    fields: [field('banking.wire.manual-attestation', 'wireManualAttestation')],
  },
  {
    id: 'nacha',
    titleKey: 'adminBanking.sections.nacha',
    fields: [
      field('banking.nacha.immediate-destination', 'immediateDestination'),
      field('banking.nacha.immediate-destination-name', 'immediateDestinationName'),
      field('banking.nacha.immediate-origin', 'immediateOrigin'),
      field('banking.nacha.immediate-origin-name', 'immediateOriginName'),
      field('banking.nacha.company-name', 'companyName'),
      field('banking.nacha.company-id', 'companyId'),
      field('banking.nacha.originating-dfi', 'originatingDfi'),
      field('banking.nacha.entry-class-code', 'entryClassCode', ['CCD', 'PPD']),
    ],
  },
  {
    id: 'controls',
    titleKey: 'adminBanking.sections.controls',
    fields: [
      field('banking.require-prenote', 'requirePrenote'),
      field('banking.exposure-limit', 'exposureLimit'),
      field('banking.statement.match-window-days', 'matchWindowDays'),
    ],
  },
  {
    id: 'balanced',
    titleKey: 'adminBanking.sections.balanced',
    fields: [
      field('banking.nacha.balanced', 'balancedFiles'),
      field('banking.nacha.offset-routing', 'offsetRouting'),
      field('banking.nacha.offset-account', 'offsetAccount'),
    ],
  },
  {
    id: 'channel',
    titleKey: 'adminBanking.sections.channel',
    fields: [
      field('banking.nacha.channel', 'channel', ['manual', 'sftp']),
      field('banking.sftp.host', 'sftpHost'),
      field('banking.sftp.port', 'sftpPort'),
      field('banking.sftp.username', 'sftpUsername'),
      field('banking.sftp.password', 'sftpPassword'),
      field('banking.sftp.host-key-fingerprint', 'sftpHostKeyFingerprint'),
      field('banking.sftp.upload-dir', 'sftpUploadDir'),
      field('banking.sftp.returns-dir', 'sftpReturnsDir'),
    ],
  },
];
