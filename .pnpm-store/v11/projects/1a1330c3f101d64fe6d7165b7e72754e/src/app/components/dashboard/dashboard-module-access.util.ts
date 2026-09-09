export interface DashboardCardRef {
  id: string;
  route: string;
}

export interface DashboardSystemModuleRef {
  name: string;
  route: string;
}

export function isDashboardModuleAvailable(
  card: DashboardCardRef,
  modules: DashboardSystemModuleRef[],
  hasPermission: (module: string, action: string) => boolean,
): boolean {
  const matched = modules.some(
    (module) =>
      module.name.toLowerCase() === card.id || module.route === card.route,
  );
  if (matched) {
    return true;
  }

  if (card.id === 'history' || card.route === '/checklist-history') {
    return hasPermission('checklists', 'read');
  }

  if (card.id === 'roles' || card.route === '/roles') {
    return hasPermission('users', 'manage');
  }

  return false;
}
