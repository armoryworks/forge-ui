export const LEAVE_HOURS_PER_DAY = 8;

export function leaveWorkdayHours(start: Date, end: Date, hoursPerDay = LEAVE_HOURS_PER_DAY): number {
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const to = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  let days = 0;
  for (const day = from; day.getTime() <= to.getTime(); day.setDate(day.getDate() + 1)) {
    const weekday = day.getDay();
    if (weekday !== 0 && weekday !== 6) days++;
  }
  return days * hoursPerDay;
}
