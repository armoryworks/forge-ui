/** An external listing and the part it fulfils from. */
export interface ChannelListing {
  id: number;
  channelId: number;
  channelName: string;
  externalListingId: string;
  externalSku: string | null;
  title: string | null;
  partId: number | null;
  partNumber: string | null;
  partName: string | null;
  listedPrice: number | null;
  publishedQuantity: number | null;
  lastSyncedAt: string | null;
  isActive: boolean;
  /** No part mapped. Orders still import; their lines just land without a part. */
  isUnmapped: boolean;
}
