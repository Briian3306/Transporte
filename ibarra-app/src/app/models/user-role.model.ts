export interface UserRole {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleCreate {
  name: string;
  description: string;
  isSystemRole?: boolean;
}

export interface UserRoleUpdate {
  name?: string;
  description?: string;
  isSystemRole?: boolean;
}
