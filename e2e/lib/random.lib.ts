/**
 * Random helpers for stress tests and human-like behavior simulation.
 * Pure functions — no Playwright dependency. Designed for generating
 * test data and adding natural variance to automated workflows.
 */

/**
 * Return a random delay duration between min and max milliseconds.
 * Use with page.waitForTimeout() to simulate human think time.
 *
 * @example
 * await page.waitForTimeout(randomDelay(500, 2000));
 */
export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Pick a random item from an array.
 * Throws if the array is empty.
 *
 * @example
 * const status = randomPick(['Active', 'Draft', 'Obsolete']);
 */
export function randomPick<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error('randomPick: cannot pick from empty array');
  }
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Generate a unique-ish string for test data, combining a prefix with
 * a timestamp fragment and random hex suffix.
 *
 * @example
 * const name = testId('part'); // "part-k8x2f7-a3b1"
 */
export function testId(prefix: string): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(16).slice(2, 6);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Return true with the given probability (0 to 1).
 *
 * @example
 * if (maybe(0.3)) { // 30% chance
 *   await addOptionalNote(page);
 * }
 */
export function maybe(probability: number): boolean {
  return Math.random() < probability;
}

/**
 * Pick N unique random items from an array (without replacement).
 * Returns up to count items; if count > array length, returns a shuffled copy.
 *
 * @example
 * const selected = randomPickN(['A', 'B', 'C', 'D', 'E'], 3);
 */
export function randomPickN<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, items.length));
}

/**
 * Generate a random integer between min and max (inclusive).
 *
 * @example
 * const qty = randomInt(1, 100);
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random date string in MM/DD/YYYY format within a range.
 * Useful for filling date fields with realistic test data.
 *
 * @param daysFromNow - Minimum days from today (can be negative for past dates)
 * @param daysRange - Range of days to span from daysFromNow
 *
 * @example
 * const futureDate = randomDate(1, 30); // 1-30 days from now
 * const pastDate = randomDate(-90, 90); // -90 to 0 days from now
 */
export function randomDate(daysFromNow: number, daysRange: number): string {
  const offset = daysFromNow + Math.floor(Math.random() * daysRange);
  const date = new Date();
  date.setDate(date.getDate() + offset);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Generate a random dollar amount string (e.g., "1234.56").
 *
 * @example
 * const amount = randomAmount(10, 5000); // "2847.31"
 */
export function randomAmount(min: number, max: number): string {
  const amount = Math.random() * (max - min) + min;
  return amount.toFixed(2);
}
