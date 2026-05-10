import { BulkLeadIntakeStrategy } from './bulk-intake.model';

export interface OutreachCampaign {
  id: number;
  name: string;
  description: string | null;
  strategy: BulkLeadIntakeStrategy;
  defaultCooldownDays: number | null;
  startedAt: string | null;
  endedAt: string | null;
  isActive: boolean;
  ownerUserId: number | null;
  leadCount: number;
  createdAt: string;
}

export interface CreateOutreachCampaignRequest {
  name: string;
  description?: string;
  strategy: BulkLeadIntakeStrategy;
  defaultCooldownDays?: number;
  startedAt?: string;
  endedAt?: string;
}

export interface UpdateOutreachCampaignRequest {
  name: string;
  description?: string;
  defaultCooldownDays?: number;
  startedAt?: string;
  endedAt?: string;
  isActive: boolean;
}
