import { test } from '@playwright/test';
import { setSimulatedClock, resetClock } from '../helpers/clock.helper';
import { getAuthSession } from '../../helpers/auth.helper';

test('diag: can set clock with admin token', async () => {
  const session = await getAuthSession('admin@forge.local', process.env['SEED_USER_PASSWORD'] ?? 'Test1234!');
  console.log(`token length: ${session.token.length}`);
  console.log(`token first 30: ${session.token.substring(0, 30)}`);
  await setSimulatedClock(new Date('2020-01-06T00:00:00Z'), session.token);
  console.log('setSimulatedClock succeeded');
  await resetClock(session.token);
  console.log('resetClock succeeded');
});
