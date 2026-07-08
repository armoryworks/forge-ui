/** regulatory-watchtower: a monitored regulatory source. */
export interface RegulatorySource {
  id: number;
  name: string;
  issuingBody: string | null;
  domain: string | null;
  url: string;
  feedType: string;
  industryGate: string | null;
  isActive: boolean;
  lastPolledAt: string | null;
}
