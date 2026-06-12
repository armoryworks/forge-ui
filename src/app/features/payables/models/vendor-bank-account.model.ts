// ⚡ BANKING BOUNDARY — masked-only projection; plaintext numbers never reach the client.
export interface VendorBankAccount {
  id: number;
  vendorId: number;
  vendorName: string;
  nickname: string;
  accountType: string;
  routingNumberMasked: string;
  accountNumberMasked: string;
  status: string;
  changedByUserId: number;
  approvedByUserId: number | null;
  approvedAt: string | null;
  prenoteSentAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}
