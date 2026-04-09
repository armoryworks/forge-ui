export interface EntityNote {
  id: number;
  text: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  createdAt: Date;
  updatedAt: Date | null;
}
