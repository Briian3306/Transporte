import { SystemModule } from './system-module.model';
import { SystemAction } from './system-action.model';

export interface ModulePermission {
  id: string;
  moduleId: string;
  actionId: string;
  module?: SystemModule;
  action?: SystemAction;
}

export interface ModulePermissionCreate {
  moduleId: string;
  actionId: string;
}

export interface ModulePermissionWithDetails {
  id: string;
  moduleId: string;
  actionId: string;
  module: SystemModule;
  action: SystemAction;
}
