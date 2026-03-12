export interface KioskTerminal {
  id: number;
  name: string;
  deviceToken: string;
  teamId: number;
  teamName: string;
  teamColor: string | null;
}

export interface Team {
  id: number;
  name: string;
  color: string | null;
  description: string | null;
  memberCount: number;
}
