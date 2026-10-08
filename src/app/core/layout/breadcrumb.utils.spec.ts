import { describe, it, expect } from 'vitest';

import { NavItem } from '../../shared/models/nav-item.model';
import { collapseRepeatedCrumbs } from './breadcrumb.utils';

function crumb(label: string, route?: string): NavItem {
  return { icon: 'circle', label, i18nKey: `nav.${label.toLowerCase()}`, route };
}

describe('collapseRepeatedCrumbs', () => {
  it('keeps the page crumb when its group carries the same label', () => {
    const trail = [crumb('Admin', '/admin/overview'), crumb('Capabilities', '/admin/capabilities'), crumb('Capabilities', '/admin/capabilities')];

    expect(collapseRepeatedCrumbs(trail).map(c => c.label)).toEqual(['Admin', 'Capabilities']);
    expect(collapseRepeatedCrumbs(trail)[1]).toBe(trail[2]);
  });

  it('leaves distinct consecutive labels alone', () => {
    const trail = [crumb('Admin'), crumb('System'), crumb('Settings', '/admin/settings')];

    expect(collapseRepeatedCrumbs(trail)).toEqual(trail);
  });

  it('only collapses neighbours, not repeats further apart', () => {
    const trail = [crumb('Integrations'), crumb('Admin'), crumb('Integrations', '/admin/integrations')];

    expect(collapseRepeatedCrumbs(trail)).toEqual(trail);
  });

  it('returns an empty trail unchanged', () => {
    expect(collapseRepeatedCrumbs([])).toEqual([]);
  });
});
