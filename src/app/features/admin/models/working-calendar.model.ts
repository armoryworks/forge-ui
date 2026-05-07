export interface Holiday {
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
  observedDate: string | null;
  isRecurring: boolean;
}

export interface WorkingCalendar {
  id: number;
  name: string;
  timeZone: string;
  workingDaysMask: number;
  isDefault: boolean;
  isActive: boolean;
  holidays: Holiday[];
  createdAt: string;
  updatedAt: string;
  // Shifts effort — calendar-bound shifts. Embedded on the detail
  // response; weekly capacity is server-computed.
  shifts: CalendarShift[];
  weeklyCapacityHours: number;
}

/**
 * Shifts effort — calendar-bound shift. Mirrors `CalendarShiftResponseModel`.
 * `daysOfWeekMask` uses the same 7-bit Sun..Sat convention as the parent
 * calendar's `workingDaysMask`. `effectiveCapacityHours` is the server's
 * resolved value (CapacityHours when set, NetHours fallback, wall-clock final).
 */
export interface CalendarShift {
  id: number;
  workingCalendarId: number;
  name: string;
  daysOfWeekMask: number;
  startTime: string; // HH:mm:ss
  endTime: string;
  premiumMultiplier: number;
  capacityHours: number;
  effectiveCapacityHours: number;
  isActive: boolean;
}

export interface CalendarShiftRequest {
  name: string;
  daysOfWeekMask: number;
  startTime: string; // HH:mm:ss
  endTime: string;
  premiumMultiplier: number;
  capacityHours: number;
  isActive: boolean;
}

export interface WorkingCalendarRequest {
  name: string;
  timeZone: string;
  workingDaysMask: number;
  isActive: boolean;
}

export interface HolidayRequest {
  date: string; // YYYY-MM-DD
  name: string;
  observedDate: string | null;
  isRecurring: boolean;
}

/**
 * 7-bit bitmask: bit 0 = Sunday, bit 1 = Monday, ..., bit 6 = Saturday.
 * Default for US installs is Mon-Fri = 0b0111110 = 62.
 */
export const WORKING_DAYS_MASK_DEFAULT = 0b0111110; // 62

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
