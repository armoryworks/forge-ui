import { CapabilityDisabledError, isCapabilityDisabledError } from './capability-disabled.error';

describe('CapabilityDisabledError', () => {
  it('preserves capabilityCode and message on the instance', () => {
    const err = new CapabilityDisabledError('CAP-EXT-AI-ASSISTANT', 'AI is disabled.');
    expect(err.capabilityCode).toBe('CAP-EXT-AI-ASSISTANT');
    expect(err.message).toBe('AI is disabled.');
    expect(err.name).toBe('CapabilityDisabledError');
  });

  it('is recognized by isCapabilityDisabledError type guard via instanceof', () => {
    const err = new CapabilityDisabledError('CAP-EXT-CHAT', 'Chat off');
    expect(isCapabilityDisabledError(err)).toBe(true);
  });

  it('is recognized by the type guard via name (cross-realm-safe)', () => {
    const fake = { name: 'CapabilityDisabledError', capabilityCode: 'X', message: 'y' };
    expect(isCapabilityDisabledError(fake)).toBe(true);
  });

  it('rejects unrelated errors via the type guard', () => {
    expect(isCapabilityDisabledError(new Error('plain'))).toBe(false);
    expect(isCapabilityDisabledError(null)).toBe(false);
    expect(isCapabilityDisabledError(undefined)).toBe(false);
    expect(isCapabilityDisabledError('text')).toBe(false);
    expect(isCapabilityDisabledError({ name: 'OtherError' })).toBe(false);
  });
});
