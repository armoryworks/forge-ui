import { type Page, request } from '@playwright/test';

const API_BASE = 'http://localhost:5000/api/v1/';

interface LoginResponse {
  token: string;
  expiresAt: string;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    initials: string | null;
    avatarColor: string | null;
    roles: string[];
  };
}

/**
 * Authenticates via the API and seeds localStorage so the Angular app
 * recognizes the session. Must be called before navigating to any
 * authenticated route.
 */
export async function loginViaApi(
  page: Page,
  email: string,
  password: string,
): Promise<LoginResponse> {
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()} ${response.statusText()}`);
  }

  const loginData: LoginResponse = await response.json();
  await apiContext.dispose();

  // Navigate to origin so localStorage is scoped correctly
  await page.goto('/', { waitUntil: 'commit' });

  // Seed localStorage with keys that AuthService reads on init
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
    },
    { token: loginData.token, user: loginData.user },
  );

  return loginData;
}

/**
 * Returns a raw JWT for making authenticated API calls from tests.
 */
export async function getAuthToken(email: string, password: string): Promise<string> {
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()} ${response.statusText()}`);
  }

  const data: LoginResponse = await response.json();
  await apiContext.dispose();
  return data.token;
}

/**
 * Returns the full login response (token + user) for pre-fetching credentials.
 */
export async function getAuthSession(email: string, password: string): Promise<LoginResponse> {
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()} ${response.statusText()}`);
  }

  const data: LoginResponse = await response.json();
  await apiContext.dispose();
  return data;
}

/**
 * Seeds localStorage from a pre-fetched token+user (no API call).
 * Use with getAuthSession() to avoid duplicate login requests.
 */
export async function seedAuth(
  page: Page,
  session: { token: string; user: LoginResponse['user'] },
): Promise<void> {
  await page.goto('http://localhost:4200/', { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
    },
    { token: session.token, user: session.user },
  );
}
