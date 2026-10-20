import { describe, it, expect } from 'vitest';

import { humanizeCode } from './humanize-code';

describe('humanizeCode', () => {
  it('splits PascalCase role and action codes into words', () => {
    expect(humanizeCode('OfficeManager')).toBe('Office Manager');
    expect(humanizeCode('UserLoggedIn')).toBe('User Logged In');
  });

  it('keeps acronym runs together', () => {
    expect(humanizeCode('BIApiKeyIssued')).toBe('BI Api Key Issued');
  });

  it('leaves single words and already-spaced codes alone', () => {
    expect(humanizeCode('Admin')).toBe('Admin');
    expect(humanizeCode('IT Admin')).toBe('IT Admin');
    expect(humanizeCode('')).toBe('');
  });
});
