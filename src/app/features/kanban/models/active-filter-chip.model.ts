export interface ActiveFilterChip {
  kind: 'member' | 'team' | 'customer';
  id: number;
  icon: string;
  label: string;
}
