import { type APIRequestContext, request } from '@playwright/test';

const API_BASE = 'http://localhost:5000/api/v1/';

/**
 * Sets the server-side simulated clock via the dev endpoint.
 * Only available in development mode — throws if unavailable.
 */
export async function setSimulatedClock(date: Date): Promise<void> {
  const ctx = await request.newContext({ baseURL: API_BASE });
  try {
    const response = await ctx.post('dev/clock', {
      data: { now: date.toISOString() },
    });
    if (!response.ok()) {
      throw new Error(`Failed to set clock to ${date.toISOString()}: ${response.status()} ${response.statusText()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

/**
 * Retrieves the current simulated clock value from the server.
 */
export async function getSimulatedClock(): Promise<Date> {
  const ctx = await request.newContext({ baseURL: API_BASE });
  try {
    const response = await ctx.get('dev/clock');
    if (!response.ok()) throw new Error(`Failed to get clock: ${response.status()}`);
    const data: { now: string } = await response.json();
    return new Date(data.now);
  } finally {
    await ctx.dispose();
  }
}

/**
 * Resets the simulated clock to real UtcNow.
 */
export async function resetClock(): Promise<void> {
  const ctx = await request.newContext({ baseURL: API_BASE });
  try {
    await ctx.delete('dev/clock');
  } finally {
    await ctx.dispose();
  }
}
