import { request } from '@playwright/test';

const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1/';

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
    ignoreHTTPSErrors: true,
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
      const errBody = await response.text().catch(() => '');
      console.warn(`  [API ${method} ${path}] ${response.status()} ${errBody.slice(0, 200)}`);
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

/**
 * Uploads a file via multipart/form-data. Returns the parsed JSON body on success
 * (typically a FileAttachment), or null on failure (logged to console).
 *
 * Playwright's request context serialises the `multipart` map into a proper
 * multipart body — the field name and an in-memory buffer are all the API needs.
 */
export async function apiUpload<T>(
  path: string,
  token: string,
  field: string,
  fileName: string,
  buffer: Buffer,
  mimeType = 'application/pdf',
): Promise<T | null> {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    const response = await ctx.post(path, {
      multipart: { [field]: { name: fileName, mimeType, buffer } },
    });
    if (!response.ok()) {
      const errBody = await response.text().catch(() => '');
      console.warn(`  [UPLOAD ${path}] ${response.status()} ${errBody.slice(0, 200)}`);
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) as T : null as T;
  } catch (err) {
    console.warn(`  [UPLOAD ${path}] ${err}`);
    return null;
  } finally {
    await ctx.dispose();
  }
}

/**
 * Minimal valid PDF bytes for a labelled fixture document (receipts, drawings,
 * certs). The API only stores the object to MinIO + a FileAttachment row; content
 * is irrelevant, but a well-formed tiny PDF keeps content-type sniffing happy.
 */
export function fixturePdf(label: string): Buffer {
  const body =
    '%PDF-1.4\n' +
    '1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj\n' +
    '2 0 obj <</Type/Pages/Kids[3 0 R]/Count 1>> endobj\n' +
    '3 0 obj <</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]/Contents 4 0 R>> endobj\n' +
    `4 0 obj <</Length ${label.length + 40}>>stream\nBT /F1 12 Tf 10 50 Td (${label}) Tj ET\nendstream endobj\n` +
    'xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000053 00000 n\n' +
    '0000000100 00000 n\n0000000175 00000 n\n' +
    'trailer <</Size 5/Root 1 0 R>>\nstartxref\n250\n%%EOF';
  return Buffer.from(body, 'utf-8');
}
