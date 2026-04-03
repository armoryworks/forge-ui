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
