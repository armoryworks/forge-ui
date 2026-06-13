import { resolveCapabilityForUrl } from './capability-endpoint-registry';

describe('resolveCapabilityForUrl', () => {
  describe('static prefix matching', () => {
    it('resolves announcements to CAP-EXT-ANNOUNCEMENTS', () => {
      expect(resolveCapabilityForUrl('/api/v1/announcements')).toBe('CAP-EXT-ANNOUNCEMENTS');
      expect(resolveCapabilityForUrl('/api/v1/announcements/all')).toBe('CAP-EXT-ANNOUNCEMENTS');
      expect(resolveCapabilityForUrl('/api/v1/announcements/templates')).toBe('CAP-EXT-ANNOUNCEMENTS');
    });

    it('resolves AI endpoints to CAP-EXT-AI-ASSISTANT', () => {
      expect(resolveCapabilityForUrl('/api/v1/ai/status')).toBe('CAP-EXT-AI-ASSISTANT');
      expect(resolveCapabilityForUrl('/api/v1/ai/generate')).toBe('CAP-EXT-AI-ASSISTANT');
      expect(resolveCapabilityForUrl('/api/v1/ai-assistants')).toBe('CAP-EXT-AI-ASSISTANT');
    });

    it('resolves planning-cycles to CAP-PLAN-MRP', () => {
      expect(resolveCapabilityForUrl('/api/v1/planning-cycles/current')).toBe('CAP-PLAN-MRP');
      expect(resolveCapabilityForUrl('/api/v1/planning-cycles')).toBe('CAP-PLAN-MRP');
      expect(resolveCapabilityForUrl('/api/v1/planning-cycles/5/entries')).toBe('CAP-PLAN-MRP');
    });

    it('resolves AP split endpoints to their dedicated capabilities', () => {
      expect(resolveCapabilityForUrl('/api/v1/vendor-bills')).toBe('CAP-P2P-BILL');
      expect(resolveCapabilityForUrl('/api/v1/vendor-bills/3/approve')).toBe('CAP-P2P-BILL');
      expect(resolveCapabilityForUrl('/api/v1/vendor-payments')).toBe('CAP-P2P-PAY');
      expect(resolveCapabilityForUrl('/api/v1/payment-transmissions')).toBe('CAP-P2P-PAY');
      expect(resolveCapabilityForUrl('/api/v1/payment-transmissions/7/retry')).toBe('CAP-P2P-PAY');
      // PO endpoints themselves keep the baseline purchasing capability.
      expect(resolveCapabilityForUrl('/api/v1/purchase-orders')).toBe('CAP-P2P-PO');
      // And the vendor master is untouched by the split.
      expect(resolveCapabilityForUrl('/api/v1/vendors/5')).toBe('CAP-MD-VENDORS');
    });

    it('handles absolute URLs by extracting the api/v1 segment', () => {
      expect(resolveCapabilityForUrl('http://localhost:5000/api/v1/announcements')).toBe('CAP-EXT-ANNOUNCEMENTS');
      expect(resolveCapabilityForUrl('https://example.com/api/v1/ai/status?foo=bar')).toBe('CAP-EXT-AI-ASSISTANT');
    });

    it('strips querystring before matching', () => {
      expect(resolveCapabilityForUrl('/api/v1/announcements?active=true')).toBe('CAP-EXT-ANNOUNCEMENTS');
    });
  });

  describe('specific-paths-before-parent ordering', () => {
    it('resolves inventory/abc to CAP-PLAN-ABC, not CAP-INV-CORE', () => {
      expect(resolveCapabilityForUrl('/api/v1/inventory/abc')).toBe('CAP-PLAN-ABC');
      expect(resolveCapabilityForUrl('/api/v1/inventory/abc/recompute')).toBe('CAP-PLAN-ABC');
    });

    it('resolves inventory/transfers to CAP-INV-MULTILOC, not CAP-INV-CORE', () => {
      expect(resolveCapabilityForUrl('/api/v1/inventory/transfers')).toBe('CAP-INV-MULTILOC');
    });

    it('falls back to inventory parent for un-specified inventory paths', () => {
      expect(resolveCapabilityForUrl('/api/v1/inventory')).toBe('CAP-INV-CORE');
      expect(resolveCapabilityForUrl('/api/v1/inventory/stock')).toBe('CAP-INV-CORE');
    });

    it('resolves reports/sankey to CAP-RPT-OPERATIONAL via specific match', () => {
      expect(resolveCapabilityForUrl('/api/v1/reports/sankey/jobs')).toBe('CAP-RPT-OPERATIONAL');
    });

    it('resolves shop-floor/andon to CAP-EXT-ANDON, distinct from shop-floor/machine', () => {
      expect(resolveCapabilityForUrl('/api/v1/shop-floor/andon')).toBe('CAP-EXT-ANDON');
      expect(resolveCapabilityForUrl('/api/v1/shop-floor/machine/state')).toBe('CAP-MFG-MACHINE-CONNECT');
    });
  });

  describe('entity-rooted endpoints', () => {
    it('resolves /{entity}/{id}/files to CAP-CROSS-ATTACHMENTS', () => {
      expect(resolveCapabilityForUrl('/api/v1/JobAttachment/42/files')).toBe('CAP-CROSS-ATTACHMENTS');
    });

    it('resolves /{entity}/{id}/activity to CAP-CROSS-ACTIVITY-LOG', () => {
      // Note: Customer is also a registered prefix — must NOT be misclassified
      // when the path is `customers/<id>/activity` (parent prefix wins by
      // declaration order). Confirmed: parent match returns CAP-MD-CUSTOMERS
      // BEFORE entity-rooted fallback. This is intentional — the customer
      // controller owns the entire customers/ path.
      expect(resolveCapabilityForUrl('/api/v1/customers/5/activity')).toBe('CAP-MD-CUSTOMERS');
      // For entity types that are NOT registered prefixes, fallback wins
      expect(resolveCapabilityForUrl('/api/v1/Job/5/activity')).toBe('CAP-CROSS-ACTIVITY-LOG');
    });
  });

  describe('non-gated and unrecognized URLs', () => {
    it('returns null for capability descriptor reads (bootstrap-exempt)', () => {
      expect(resolveCapabilityForUrl('/api/v1/capabilities/descriptor')).toBeNull();
      expect(resolveCapabilityForUrl('/api/v1/capabilities')).toBeNull();
    });

    it('returns null for auth/identity endpoints', () => {
      expect(resolveCapabilityForUrl('/api/v1/auth/login')).toBeNull();
      expect(resolveCapabilityForUrl('/api/v1/discovery/questions')).toBeNull();
    });

    it('returns null for non-api URLs', () => {
      expect(resolveCapabilityForUrl('https://api.openai.com/v1/chat')).toBeNull();
      expect(resolveCapabilityForUrl('/assets/i18n/en.json')).toBeNull();
    });

    it('returns null for empty / nonsense paths', () => {
      expect(resolveCapabilityForUrl('')).toBeNull();
      expect(resolveCapabilityForUrl('/api/v1/')).toBeNull();
      expect(resolveCapabilityForUrl('/api/v1/unknown-path')).toBeNull();
    });
  });

  describe('exact-prefix vs prefix-of-name distinction', () => {
    it('does not match when the prefix is a substring of a longer path segment', () => {
      // `aircrafts` should not match `ai`
      expect(resolveCapabilityForUrl('/api/v1/aircrafts/list')).toBeNull();
      // `customs` should not match `customers`
      expect(resolveCapabilityForUrl('/api/v1/customs/declarations')).toBeNull();
    });
  });
});
