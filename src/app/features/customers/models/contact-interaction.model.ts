export interface ContactInteraction {
  id: number;
  contactId: number;
  contactName: string;
  userId: number;
  userName: string;
  type: string;
  subject: string;
  body: string | null;
  interactionDate: string;
  durationMinutes: number | null;
  createdAt: string;
}

export interface ContactInteractionRequest {
  contactId?: number | null;
  type: string;
  subject: string;
  body?: string | null;
  interactionDate: string;
  durationMinutes?: number | null;
}
