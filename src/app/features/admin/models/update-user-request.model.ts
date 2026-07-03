export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  initials?: string;
  avatarColor?: string;
  isActive?: boolean;
  roles?: string[];
  email?: string;
}
