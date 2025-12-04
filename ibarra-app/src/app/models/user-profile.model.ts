import { UserRole } from './user-role.model';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  roleIds: string[];
  roles?: UserRole[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileCreate {
  email: string;
  fullName: string;
  roleIds: string[];
  isActive?: boolean;
  password?: string;
}

export interface UserProfileUpdate {
  email?: string;
  fullName?: string;
  roleIds?: string[];
  isActive?: boolean;
}

export interface UserProfileWithRole extends UserProfile {
  roles: UserRole[];
}
