export interface SystemAction {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface SystemActionCreate {
  name: string;
  description: string;
}

export interface SystemActionUpdate {
  name?: string;
  description?: string;
}
