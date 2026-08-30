import { CrashReportingService } from './crash-reporting.service';

describe('CrashReportingService.parseDsn', () => {
  it('turns a Sentry-style DSN into the project store endpoint and public key', () => {
    expect(CrashReportingService.parseDsn('https://abc123@glitchtip.shop.example/2')).toEqual({
      endpoint: 'https://glitchtip.shop.example/api/2/store/',
      key: 'abc123',
    });
  });

  it('keeps a path prefix and port', () => {
    expect(CrashReportingService.parseDsn('https://k@forge.example:8443/crash/7')).toEqual({
      endpoint: 'https://forge.example:8443/api/crash/7/store/',
      key: 'k',
    });
  });

  it('rejects anything without a key or project', () => {
    expect(CrashReportingService.parseDsn(null)).toBeNull();
    expect(CrashReportingService.parseDsn('')).toBeNull();
    expect(CrashReportingService.parseDsn('https://glitchtip.shop.example/2')).toBeNull();
    expect(CrashReportingService.parseDsn('https://abc@glitchtip.shop.example/')).toBeNull();
    expect(CrashReportingService.parseDsn('not a url')).toBeNull();
  });
});
