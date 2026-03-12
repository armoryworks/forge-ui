export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  initials?: string;
  avatarColor?: string;
  role: string;
}

export interface CreateUserResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  initials: string | null;
  avatarColor: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  setupToken: string;
  setupTokenExpiresAt: string;
}
