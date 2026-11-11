import { describe, it, expect } from 'vitest';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../services/auth.service';
import { overToleranceInfo } from './over-tolerance-info';

const translate = { instant: (key: string) => `[${key}]` } as unknown as TranslateService;

function auth(...roles: string[]): AuthService {
  return { hasAnyRole: (wanted: string[]) => wanted.some(role => roles.includes(role)) } as unknown as AuthService;
}

describe('overToleranceInfo', () => {
  it('gives a role that may raise the tolerance the base hint alone', () => {
    expect(overToleranceInfo(translate, auth('Manager'), 'tolerance.vendorHint')).toBe('[tolerance.vendorHint]');
    expect(overToleranceInfo(translate, auth('Admin'))).toBe('');
  });

  it('tells every other role who may raise it', () => {
    expect(overToleranceInfo(translate, auth('Procurement'), 'tolerance.vendorHint'))
      .toBe('[tolerance.vendorHint] [tolerance.raiseNeedsManager]');
    expect(overToleranceInfo(translate, auth('OfficeManager', 'PM'))).toBe('[tolerance.raiseNeedsManager]');
  });
});
