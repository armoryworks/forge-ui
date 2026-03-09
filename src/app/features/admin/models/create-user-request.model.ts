export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  initials?: string;
  avatarColor?: string;
  password: string;
  role: string;
}
