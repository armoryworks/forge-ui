import { request } from '@playwright/test';

const API_BASE = 'http://localhost:5000/api/v1/';

/**
 * Makes an authenticated API call. Returns null on failure (logged to console).
 */
export async function apiCall<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  token: string,
  body?: unknown,
): Promise<T | null> {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    let response;
    switch (method) {
      case 'GET':    response = await ctx.get(path); break;
      case 'POST':   response = await ctx.post(path, { data: body }); break;
      case 'PUT':    response = await ctx.put(path, { data: body }); break;
      case 'PATCH':  response = await ctx.patch(path, { data: body }); break;
      case 'DELETE': response = await ctx.delete(path); break;
    }
    if (!response.ok()) {
      console.warn(`  [API ${method} ${path}] ${response.status()}`);
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) as T : null as T;
  } catch (err) {
    console.warn(`  [API ${method} ${path}] ${err}`);
    return null;
  } finally {
    await ctx.dispose();
  }
}
