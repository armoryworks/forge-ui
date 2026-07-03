export interface AppEvent {
  id: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  eventType: string;
  // compliance-calendar A-1: configurable taxonomy (nullable during expand).
  eventTypeId: number | null;
  superGroupId: number | null;
  isRequired: boolean;
  isCancelled: boolean;
  createdByUserId: number;
  createdByName: string;
  attendees: EventAttendee[];
  createdAt: string;
}

export interface EventAttendee {
  id: number;
  userId: number;
  userName: string;
  status: string;
  respondedAt: string | null;
}

export interface EventRequest {
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  location?: string | null;
  eventType: string;
  eventTypeId?: number | null;
  isRequired: boolean;
  attendeeUserIds: number[];
}
