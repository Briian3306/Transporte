export interface PermissionCheck {
  module: string;
  action: string;
}

export interface RolePermission {
  id: string;
  roleId: string;
  modulePermissionId: string;
  modulePermission?: {
    id: string;
    moduleId: string;
    actionId: string;
    module?: {
      id: string;
      name: string;
      description: string;
      icon: string;
      route: string;
    };
    action?: {
      id: string;
      name: string;
      description: string;
    };
  };
}

export interface UserPermission {
  module: string;
  action: string;
  hasPermission: boolean;
}
