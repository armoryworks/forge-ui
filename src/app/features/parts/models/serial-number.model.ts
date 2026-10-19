export type SerialNumberStatus = 'Available' | 'InUse' | 'Shipped' | 'Returned' | 'Scrapped' | 'Quarantined';

export interface SerialNumber {
  id: number;
  partId: number;
  partNumber: string;
  serialValue: string;
  status: SerialNumberStatus;
  jobId: number | null;
  jobNumber: string | null;
  lotRecordId: number | null;
  lotNumber: string | null;
  currentLocationId: number | null;
  currentLocationName: string | null;
  shipmentLineId: number | null;
  customerId: number | null;
  customerName: string | null;
  parentSerialId: number | null;
  parentSerialValue: string | null;
  manufacturedAt: string | null;
  shippedAt: string | null;
  scrappedAt: string | null;
  notes: string | null;
  createdAt: string;
  childCount: number;
}

export interface SerialHistory {
  id: number;
  serialNumberId: number;
  action: string;
  fromLocationName: string | null;
  toLocationName: string | null;
  actorId: number | null;
  details: string | null;
  occurredAt: string;
}

export interface SerialGenealogyLot {
  lotId: number | null;
  lotNumber: string;
  partId: number;
  partNumber: string;
  source: 'Lot' | 'MaterialIssue';
  quantity: number | null;
}

export interface SerialGenealogy {
  id: number;
  serialValue: string;
  partNumber: string;
  status: SerialNumberStatus;
  children: SerialGenealogy[];
  jobId?: number | null;
  jobNumber?: string | null;
  lots?: SerialGenealogyLot[] | null;
}

export interface CreateSerialNumberRequest {
  serialValue: string;
  jobId?: number;
  lotRecordId?: number;
  currentLocationId?: number;
  parentSerialId?: number;
  notes?: string;
}

export interface TransferSerialRequest {
  toLocationId: number;
  notes?: string;
}
