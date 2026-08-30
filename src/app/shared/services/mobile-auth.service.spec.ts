import { MobileAuthService } from './mobile-auth.service';

describe('MobileAuthService.normalizeOrigin', () => {
  it('adds https to a bare host', () => {
    expect(MobileAuthService.normalizeOrigin('shop.example.com')).toBe('https://shop.example.com');
  });

  it('strips paths and trailing slashes down to the origin', () => {
    expect(MobileAuthService.normalizeOrigin('https://shop.example.com/some/path/'))
      .toBe('https://shop.example.com');
  });

  it('keeps an explicit port', () => {
    expect(MobileAuthService.normalizeOrigin('shop.example.com:8443'))
      .toBe('https://shop.example.com:8443');
  });

  it('refuses plain http', () => {
    expect(() => MobileAuthService.normalizeOrigin('http://shop.example.com')).toThrow();
  });
});
