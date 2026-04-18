/**
 * Query helpers that fetch existing entity IDs so week scenarios can
 * make state-aware decisions (advance THIS lead, quote THAT customer, etc.)
 */

import { apiCall } from './api.helper';

export interface LeadListItem {
  id: number;
  companyName: string;
  status: string;
}

export interface CustomerListItem {
  id: number;
  name: string;
}

export interface QuoteListItem {
  id: number;
  quoteNumber?: string;
  customerId: number;
  customerName?: string;
  status: string;
  totalAmount: number;
}

export interface JobListItem {
  id: number;
  jobNumber?: string;
  title: string;
  currentStageId: number;
  currentStageName: string;
  trackTypeId: number;
  customerId: number | null;
  priority: string;
}

export interface TrackTypeInfo {
  id: number;
  name: string;
  isDefault: boolean;
  stages: Array<{ id: number; name: string; sortOrder: number }>;
}

export interface SalesOrderListItem {
  id: number;
  status: string;
  customerId: number;
}

export interface InvoiceListItem {
  id: number;
  status: string;
  jobId: number | null;
  totalAmount: number;
}

export interface UserListItem {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

/** Get open (not Converted/Lost) leads */
export async function getOpenLeads(token: string): Promise<LeadListItem[]> {
  const result = await apiCall<{ data: LeadListItem[] }>('GET', 'leads?pageSize=100', token);
  return (result?.data ?? []).filter(l => l.status !== 'Converted' && l.status !== 'Lost');
}

/** Get all leads including converted (for tracking) */
export async function getAllLeads(token: string): Promise<LeadListItem[]> {
  const result = await apiCall<{ data: LeadListItem[] }>('GET', 'leads?pageSize=100', token);
  return result?.data ?? [];
}

/** Get customers */
export async function getCustomers(token: string): Promise<CustomerListItem[]> {
  const result = await apiCall<{ data: CustomerListItem[] }>('GET', 'customers?pageSize=100', token);
  return result?.data ?? [];
}

/** Get draft quotes (ready to be sent/accepted) */
export async function getDraftQuotes(token: string): Promise<QuoteListItem[]> {
  const result = await apiCall<{ data: QuoteListItem[] }>('GET', 'quotes?pageSize=100', token);
  return (result?.data ?? []).filter(q => q.status === 'Draft');
}

/** Get sent quotes (waiting for acceptance) */
export async function getSentQuotes(token: string): Promise<QuoteListItem[]> {
  const result = await apiCall<{ data: QuoteListItem[] }>('GET', 'quotes?pageSize=100', token);
  return (result?.data ?? []).filter(q => q.status === 'Sent');
}

/** Get accepted quotes (ready to convert to SO) */
export async function getAcceptedQuotes(token: string): Promise<QuoteListItem[]> {
  const result = await apiCall<{ data: QuoteListItem[] }>('GET', 'quotes?pageSize=100', token);
  return (result?.data ?? []).filter(q => q.status === 'Accepted');
}

/** Get active jobs (not in first or last stage — i.e., in progress) */
export async function getActiveJobs(token: string): Promise<JobListItem[]> {
  const result = await apiCall<{ data: JobListItem[] }>('GET', 'jobs?pageSize=200', token);
  return result?.data ?? [];
}

/** Get jobs by stage name fragment (case-insensitive contains) */
export async function getJobsInStage(token: string, stageName: string): Promise<JobListItem[]> {
  const all = await getActiveJobs(token);
  return all.filter(j => j.currentStageName?.toLowerCase().includes(stageName.toLowerCase()));
}

/** Get all track types with stages */
export async function getTrackTypes(token: string): Promise<TrackTypeInfo[]> {
  const result = await apiCall<TrackTypeInfo[]>('GET', 'track-types', token);
  return result ?? [];
}

/** Get the default (production) track type */
export async function getDefaultTrackType(token: string): Promise<TrackTypeInfo | null> {
  const types = await getTrackTypes(token);
  return types.find(t => t.isDefault) ?? types[0] ?? null;
}

/** Get the next stage for a job (based on current stage sort order) */
export function getNextStage(
  trackType: TrackTypeInfo,
  currentStageId: number,
): { id: number; name: string } | null {
  const sorted = [...trackType.stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex(s => s.id === currentStageId);
  if (idx === -1 || idx >= sorted.length - 1) return null;
  return sorted[idx + 1];
}

/** Get open sales orders */
export async function getOpenSalesOrders(token: string): Promise<SalesOrderListItem[]> {
  const result = await apiCall<{ data: SalesOrderListItem[] }>('GET', 'orders?pageSize=100', token);
  return (result?.data ?? []).filter(so => so.status !== 'Completed' && so.status !== 'Cancelled');
}

/** Get uninvoiced shipped jobs */
export async function getUninvoicedJobs(token: string): Promise<Array<{ id: number; title: string }>> {
  const result = await apiCall<Array<{ id: number; title: string }>>('GET', 'invoices/uninvoiced-jobs', token);
  return result ?? [];
}

/** Get users for assignment */
export async function getEngineers(token: string): Promise<UserListItem[]> {
  const result = await apiCall<{ data: UserListItem[] }>('GET', 'admin/users?pageSize=50', token);
  const users = result?.data ?? [];
  return users.filter(u => u.roles?.includes('Engineer') || u.roles?.includes('ProductionWorker'));
}

// ── Additional entity queries for expanded simulation ─────────────────────

export interface PartListItem {
  id: number;
  partNumber: string;
  description: string;
  status: string;
}

export interface VendorListItem {
  id: number;
  name: string;
}

export interface AssetListItem {
  id: number;
  name: string;
  assetType: string;
  status: string;
}

export interface StorageLocationItem {
  id: number;
  name: string;
  locationType: string;
}

export interface EventListItem {
  id: number;
  title: string;
  eventType: string;
  startDate: string;
}

/** Get parts */
export async function getParts(token: string): Promise<PartListItem[]> {
  const result = await apiCall<{ data: PartListItem[] }>('GET', 'parts?pageSize=100', token);
  return result?.data ?? [];
}

/** Get vendors */
export async function getVendors(token: string): Promise<VendorListItem[]> {
  const result = await apiCall<{ data: VendorListItem[] }>('GET', 'vendors?pageSize=100', token);
  return result?.data ?? [];
}

/** Get assets */
export async function getAssets(token: string): Promise<AssetListItem[]> {
  const result = await apiCall<{ data: AssetListItem[] }>('GET', 'assets?pageSize=100', token);
  return result?.data ?? [];
}

/** Get storage locations */
export async function getStorageLocations(token: string): Promise<StorageLocationItem[]> {
  const result = await apiCall<{ data: StorageLocationItem[] }>('GET', 'inventory/locations?pageSize=100', token);
  return result?.data ?? [];
}

/** Get events */
export async function getEvents(token: string): Promise<EventListItem[]> {
  const result = await apiCall<{ data: EventListItem[] }>('GET', 'events?pageSize=50', token);
  return result?.data ?? [];
}

/** Get open invoices (for payment tracking) */
export async function getOpenInvoices(token: string): Promise<InvoiceListItem[]> {
  const result = await apiCall<{ data: InvoiceListItem[] }>('GET', 'invoices?pageSize=100', token);
  return (result?.data ?? []).filter(i => i.status === 'Sent' || i.status === 'Draft');
}

/** Get all invoices */
export async function getAllInvoices(token: string): Promise<InvoiceListItem[]> {
  const result = await apiCall<{ data: InvoiceListItem[] }>('GET', 'invoices?pageSize=200', token);
  return result?.data ?? [];
}

/** Get sent invoices (ready for payment) */
export async function getSentInvoices(token: string): Promise<InvoiceListItem[]> {
  const result = await apiCall<{ data: InvoiceListItem[] }>('GET', 'invoices?pageSize=100', token);
  return (result?.data ?? []).filter(i => i.status === 'Sent');
}

// ── Shipment queries ────────────────────────────────────────────────────────

export interface ShipmentListItem {
  id: number;
  shipmentNumber?: string;
  salesOrderId: number | null;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
}

/** Get all shipments */
export async function getShipments(token: string): Promise<ShipmentListItem[]> {
  const result = await apiCall<{ data: ShipmentListItem[] }>('GET', 'shipments?pageSize=100', token);
  return result?.data ?? [];
}

// ── Purchase Order queries ──────────────────────────────────────────────────

export interface PurchaseOrderListItem {
  id: number;
  poNumber: string;
  vendorId: number;
  vendorName?: string;
  status: string;
  totalAmount: number;
}

/** Get purchase orders by status */
export async function getPurchaseOrdersByStatus(token: string, status: string): Promise<PurchaseOrderListItem[]> {
  const result = await apiCall<{ data: PurchaseOrderListItem[] }>('GET', `purchase-orders?pageSize=50`, token);
  return (result?.data ?? []).filter(po => po.status === status);
}

/** Get all purchase orders */
export async function getAllPurchaseOrders(token: string): Promise<PurchaseOrderListItem[]> {
  const result = await apiCall<{ data: PurchaseOrderListItem[] }>('GET', 'purchase-orders?pageSize=200', token);
  return result?.data ?? [];
}

// ── Sales Order queries ─────────────────────────────────────────────────────

export interface SalesOrderDetail {
  id: number;
  status: string;
  customerId: number;
  lines: Array<{ id: number; quantity: number; quantityShipped: number; partId: number | null }>;
}

/** Get confirmed/in-production SOs (ready for shipment) */
export async function getShippableSalesOrders(token: string): Promise<SalesOrderListItem[]> {
  const result = await apiCall<{ data: SalesOrderListItem[] }>('GET', 'orders?pageSize=100', token);
  return (result?.data ?? []).filter(so =>
    so.status === 'Confirmed' || so.status === 'InProduction' || so.status === 'PartiallyShipped',
  );
}

/** Get SO detail with lines */
export async function getSalesOrderDetail(token: string, soId: number): Promise<SalesOrderDetail | null> {
  return apiCall<SalesOrderDetail>('GET', `orders/${soId}`, token);
}

// ── QC queries ──────────────────────────────────────────────────────────────

export interface QcTemplateListItem {
  id: number;
  name: string;
  isActive: boolean;
}

/** Get active QC templates */
export async function getQcTemplates(token: string): Promise<QcTemplateListItem[]> {
  const result = await apiCall<QcTemplateListItem[]>('GET', 'quality/templates', token);
  return (result ?? []).filter(t => t.isActive);
}

// ── Lot queries ─────────────────────────────────────────────────────────────

export interface LotListItem {
  id: number;
  lotNumber: string;
  partId: number | null;
  quantity: number;
}

/** Get lots */
export async function getLots(token: string): Promise<LotListItem[]> {
  const result = await apiCall<{ data: LotListItem[] }>('GET', 'lots?pageSize=50', token);
  return result?.data ?? [];
}

// ── Customer return queries ─────────────────────────────────────────────────

export interface CustomerReturnListItem {
  id: number;
  customerId: number;
  status: string;
  reason: string;
}

/** Get open customer returns */
export async function getOpenReturns(token: string): Promise<CustomerReturnListItem[]> {
  const result = await apiCall<{ data: CustomerReturnListItem[] }>('GET', 'customer-returns?pageSize=50', token);
  return (result?.data ?? []).filter(r => r.status !== 'Closed' && r.status !== 'Resolved');
}

// ── User queries ────────────────────────────────────────────────────────────

/** Get all active users (for chat, mentions, assignments) */
export async function getAllUsers(token: string): Promise<UserListItem[]> {
  const result = await apiCall<{ data: UserListItem[] }>('GET', 'admin/users?pageSize=50', token);
  return result?.data ?? [];
}

// ── Contact queries ─────────────────────────────────────────────────────────

export interface ContactListItem {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  isPrimary: boolean;
}

/** Get contacts for a customer */
export async function getCustomerContacts(token: string, customerId: number): Promise<ContactListItem[]> {
  const result = await apiCall<ContactListItem[]>('GET', `customers/${customerId}/contacts`, token);
  return result ?? [];
}
