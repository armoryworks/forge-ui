import { describe, expect, it } from 'vitest';

import { humanizeIdentifier } from './humanize-identifier';

describe('humanizeIdentifier', () => {
  it('splits PascalCase into a sentence-case label', () => {
    expect(humanizeIdentifier('FileAttachment')).toBe('File attachment');
    expect(humanizeIdentifier('PartNumber')).toBe('Part number');
    expect(humanizeIdentifier('Job')).toBe('Job');
  });

  it('splits snake case and keeps acronyms', () => {
    expect(humanizeIdentifier('job_hold_type')).toBe('Job hold type');
    expect(humanizeIdentifier('CustomerPO')).toBe('Customer PO');
    expect(humanizeIdentifier('ncr_type')).toBe('Ncr type');
  });

  it('turns a dotted group into a dash-separated label', () => {
    expect(humanizeIdentifier('part.item_kind')).toBe('Part — Item kind');
  });
});
