export interface SystemModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
}

export interface SystemModuleCreate {
  name: string;
  description: string;
  icon: string;
  route: string;
  orderIndex?: number;
  isActive?: boolean;
}

export interface SystemModuleUpdate {
  name?: string;
  description?: string;
  icon?: string;
  route?: string;
  orderIndex?: number;
  isActive?: boolean;
}
