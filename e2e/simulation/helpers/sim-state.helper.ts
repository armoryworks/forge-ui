import { type APIRequestContext, request } from '@playwright/test';

const API_BASE = 'http://localhost:5000/api/v1/';

export interface SimulationState {
  openLeads: number;
  openQuotes: number;
  openSalesOrders: number;
  jobsByStage: Record<string, number>;
  unpaidInvoices: number;
  overduePos: number;
  activeTimers: number;
  pendingExpenses: number;
}

/**
 * Fetches the current simulation state summary from the dev endpoint.
 * Used by week scenarios to make algorithmic decisions about what to advance.
 */
export async function getSimulationState(token: string): Promise<SimulationState> {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    const response = await ctx.get('dev/simulation-state');
    if (!response.ok()) {
      // Return empty state if endpoint not yet available
      return {
        openLeads: 0, openQuotes: 0, openSalesOrders: 0,
        jobsByStage: {}, unpaidInvoices: 0, overduePos: 0,
        activeTimers: 0, pendingExpenses: 0,
      };
    }
    return await response.json();
  } finally {
    await ctx.dispose();
  }
}
