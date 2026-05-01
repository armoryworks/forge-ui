import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { PartDetailLayoutResolverService } from './part-detail-layout-resolver.service';

describe('PartDetailLayoutResolverService', () => {
  let service: PartDetailLayoutResolverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PartDetailLayoutResolverService);
  });

  it('Buy + Raw → identity, sourcing, inventory, quality, cost, activity, files', () => {
    const ids = service.resolve('Buy', 'Raw').map(t => t.id);
    expect(ids).toEqual(['identity', 'sourcing', 'inventory', 'quality', 'cost', 'activity', 'files']);
  });

  it('Make + Subassembly → identity, material, bom, routing, inventory, mrp, cost, quality, alternates, activity, files', () => {
    const ids = service.resolve('Make', 'Subassembly').map(t => t.id);
    expect(ids).toEqual([
      'identity', 'material', 'bom', 'routing', 'inventory', 'mrp', 'cost', 'quality', 'alternates', 'activity', 'files',
    ]);
  });

  it('Phantom + Subassembly → identity, bom, activity, files (very narrow set)', () => {
    const ids = service.resolve('Phantom', 'Subassembly').map(t => t.id);
    expect(ids).toEqual(['identity', 'bom', 'activity', 'files']);
  });

  it('unknown combo defaults to Buy + Component layout', () => {
    // Phantom + Raw is not a viable combo per Section 2 — should default.
    const ids = service.resolve('Phantom', 'Raw').map(t => t.id);
    expect(ids).toEqual(['identity', 'sourcing', 'inventory', 'quality', 'cost', 'alternates', 'activity', 'files']);
  });

  it('Identity always first; Activity then Files always last across every combo', () => {
    const procs = ['Buy', 'Make', 'Subcontract', 'Phantom'] as const;
    const classes = ['Raw', 'Component', 'Subassembly', 'FinishedGood', 'Consumable', 'Tool'] as const;
    for (const p of procs) {
      for (const c of classes) {
        const layout = service.resolve(p, c);
        expect(layout[0].id, `first tab for ${p}+${c}`).toBe('identity');
        expect(layout[layout.length - 2].id, `second-to-last for ${p}+${c}`).toBe('activity');
        expect(layout[layout.length - 1].id, `last tab for ${p}+${c}`).toBe('files');
      }
    }
  });

  it('Buy + Consumable (B5) hides Quality and Alternates', () => {
    const ids = service.resolve('Buy', 'Consumable').map(t => t.id);
    expect(ids).not.toContain('quality');
    expect(ids).not.toContain('alternates');
  });

  it('Make + Tool (M4) limits to material/bom/routing in the middle (lives as Asset)', () => {
    const ids = service.resolve('Make', 'Tool').map(t => t.id);
    expect(ids).toEqual(['identity', 'material', 'bom', 'routing', 'activity', 'files']);
  });
});
