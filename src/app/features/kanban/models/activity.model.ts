export interface Activity {
  id: number;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  description: string;
  userInitials: string | null;
  userName: string | null;
  createdAt: Date;
}
