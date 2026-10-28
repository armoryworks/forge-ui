import { describe, it, expect } from 'vitest';

import en from '../../../../public/assets/i18n/en.json';
import es from '../../../../public/assets/i18n/es.json';
import { SETTINGS_DIRECTORY } from '../models/settings-directory.const';
import { routeAccessFor } from '../models/route-access.model';
import { ADMIN_SETTINGS_DIRECTORY } from '../../features/admin/models/admin-settings-directory.const';
import { matchSettingsDirectory } from './settings-directory.utils';

function lookup(catalog: unknown, key: string): string {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog) as string;
}

const all = [...SETTINGS_DIRECTORY, ...ADMIN_SETTINGS_DIRECTORY];
const open = () => true;

describe('settings directory', () => {
  it('resolves every label and screen name in both catalogs', () => {
    for (const entry of all) {
      for (const key of [...entry.textKeys, entry.whereKey]) {
        expect(typeof lookup(en, key), `en ${key}`).toBe('string');
        expect(typeof lookup(es, key), `es ${key}`).toBe('string');
      }
    }
  });

  it('never offers a setting to a role the route itself refuses', () => {
    for (const entry of all) {
      const routeRoles = routeAccessFor(entry.route)?.roles;
      if (!routeRoles?.length) continue;
      for (const role of entry.access.roles ?? []) {
        expect(routeRoles, `${entry.key} ${role}`).toContain(role);
      }
    }
  });

  it('finds the fiscal year start on period close in English and Spanish', () => {
    expect(matchSettingsDirectory(all, 'fiscal', key => lookup(en, key), open).map(e => e.key)).toContain('fiscal-year-start');
    expect(matchSettingsDirectory(all, 'año fiscal', key => lookup(es, key), open).map(e => e.key)).toContain('fiscal-year-start');
  });

  it('leaves out what the signed-in user may not open', () => {
    const adminOnly = (entry: { access: { roles?: readonly string[] } }) => entry.access.roles?.includes('Admin') ?? false;

    const keys = matchSettingsDirectory(all, 'fiscal', key => lookup(en, key), adminOnly).map(e => e.key);

    expect(keys).not.toContain('fiscal-year-start');
  });

  it('finds the settings added by the finance suite', () => {
    const keysFor = (query: string) => matchSettingsDirectory(all, query, key => lookup(en, key), open).map(e => e.key);

    expect(keysFor('maker-checker')).toContain('maker-checker-threshold');
    expect(keysFor('payment terms')).toContain('payment-terms');
    expect(keysFor('exchange rate')).toContain('exchange-rates');
    expect(keysFor('freight')).toEqual(expect.arrayContaining(['account-mapping', 'sales-tax-rates', 'quickbooks-items']));
    expect(keysFor('discount')).toEqual(expect.arrayContaining(['payments-credits', 'payment-terms']));
    expect(keysFor('restocking')).toContain('payments-credits');
    expect(keysFor('write-offs')).toContain('payments-credits');
    expect(keysFor('quickbooks')).toContain('quickbooks-items');
    expect(keysFor('labor split')).toContain('shop-floor-rules');
  });

  it('matches nothing for an empty query', () => {
    expect(matchSettingsDirectory(all, '', key => lookup(en, key), open)).toEqual([]);
  });
});
