import { type APIRequestContext, request } from '@playwright/test';

const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1/';

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function setSimulatedClock(date: Date, token?: string): Promise<void> {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: authHeaders(token),
  });
  try {
    const response = await ctx.post('dev/clock', {
      data: { now: date.toISOString() },
    });
    if (!response.ok()) {
      const body = await response.text().catch(() => '');
      const tokHint = token ? `${token.slice(0, 8)}…${token.slice(-8)} (len=${token.length})` : 'none';
      throw new Error(
        `Failed to set clock to ${date.toISOString()}: ${response.status()} ${response.statusText()} — body=${body.slice(0, 200)} token=${tokHint}`,
      );
    }
  } finally {
    await ctx.dispose();
  }
}

export async function getSimulatedClock(token?: string): Promise<Date> {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: authHeaders(token),
  });
  try {
    const response = await ctx.get('dev/clock');
    if (!response.ok()) throw new Error(`Failed to get clock: ${response.status()}`);
    const data: { now: string } = await response.json();
    return new Date(data.now);
  } finally {
    await ctx.dispose();
  }
}

export async function resetClock(token?: string): Promise<void> {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: authHeaders(token),
  });
  try {
    await ctx.delete('dev/clock');
  } finally {
    await ctx.dispose();
  }
}
