/** Message time in the active language's short form, e.g. "3:05 PM" (en) or "15:05" (es). */
export function formatChatTime(date: Date | string, lang: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Day-separator label to show above `messages[index]`, or null when it continues the previous
 * message's day (or is the first message and from today). Today and yesterday use the
 * translated `chat.today` / `chat.yesterday` labels; older days use a localised date.
 */
export function chatDateSeparator(
  messages: readonly { createdAt: Date | string }[],
  index: number,
  lang: string,
  translate: (key: string) => string,
  now: Date = new Date(),
): string | null {
  if (index < 0 || index >= messages.length) return null;
  const current = new Date(messages[index].createdAt);
  const isToday = dayKey(current) === dayKey(now);

  if (index > 0 && dayKey(new Date(messages[index - 1].createdAt)) === dayKey(current)) return null;
  if (isToday) return index === 0 ? null : translate('chat.today');

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(current) === dayKey(yesterday)) return translate('chat.yesterday');
  return current.toLocaleDateString(lang, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
