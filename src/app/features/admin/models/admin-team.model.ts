export interface AdminTeam {
  id: number;
  name: string;
  color: string | null;
  description: string | null;
  memberCount: number;
}

export interface TeamMember {
  id: number;
  firstName: string;
  lastName: string;
  initials: string | null;
  avatarColor: string | null;
  email: string;
  isActive: boolean;
}

export interface KioskTerminal {
  id: number;
  name: string;
  deviceToken: string;
  teamId: number;
  teamName: string;
  teamColor: string | null;
}
