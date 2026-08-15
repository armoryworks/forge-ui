import { ChannelSettlement } from './channel-settlement.model';
import { ChannelSettlementLine } from './channel-settlement-line.model';

export interface ChannelSettlementDetail {
  settlement: ChannelSettlement;
  lines: ChannelSettlementLine[];
}
