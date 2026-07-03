/** compliance-calendar A-3: a saved overlay-layer selection (personal or role-default). */
export interface CalendarSavedView {
  id: number;
  name: string;
  ownerUserId: number | null;
  roleKey: string | null;
  scope: string;
  selectedSuperGroupIds: number[];
  selectedEventTypeIds: number[];
  isDefault: boolean;
}
