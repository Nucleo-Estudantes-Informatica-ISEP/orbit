const PEOPLE_PERMISSIONS = [
  'USERS_VIEW',
  'USERS_CREATE',
  'USERS_READ',
  'USERS_UPDATE',
  'USERS_DELETE',
  'ROLES_VIEW',
  'ROLES_CREATE',
  'ROLES_READ',
  'ROLES_UPDATE',
  'ROLES_DELETE',
  'DEPARTMENTS_VIEW',
  'DEPARTMENTS_CREATE',
  'DEPARTMENTS_READ',
  'DEPARTMENTS_UPDATE',
  'DEPARTMENTS_DELETE',
] as const;

const CONTENT_PERMISSIONS = [
  'ANNOUNCEMENTS_VIEW',
  'ANNOUNCEMENTS_CREATE',
  'ANNOUNCEMENTS_READ',
  'ANNOUNCEMENTS_UPDATE',
  'ANNOUNCEMENTS_DELETE',
  'EVENTS_VIEW',
  'EVENTS_CREATE',
  'EVENTS_READ',
  'EVENTS_UPDATE',
  'EVENTS_DELETE',
  'RESOURCES_VIEW',
  'RESOURCES_CREATE',
  'RESOURCES_READ',
  'RESOURCES_UPDATE',
  'RESOURCES_DELETE',
] as const;

const OPERATIONS_PERMISSIONS = [
  'PROJECTS_VIEW',
  'PROJECTS_CREATE',
  'PROJECTS_READ',
  'PROJECTS_UPDATE',
  'PROJECTS_DELETE',
  'TASKS_VIEW',
  'TASKS_CREATE',
  'TASKS_READ',
  'TASKS_UPDATE',
  'TASKS_DELETE',
  'RECRUITMENT_VIEW',
  'RECRUITMENT_CREATE',
  'RECRUITMENT_READ',
  'RECRUITMENT_UPDATE',
  'RECRUITMENT_DELETE',
  'BOARDS_VIEW',
  'BOARDS_CREATE',
  'BOARDS_READ',
  'BOARDS_UPDATE',
  'BOARDS_DELETE',
] as const;

const MANAGEMENT_PERMISSIONS = [
  'INVENTORY_VIEW',
  'INVENTORY_CREATE',
  'INVENTORY_READ',
  'INVENTORY_UPDATE',
  'INVENTORY_DELETE',
  'PLANS_VIEW',
  'PLANS_CREATE',
  'PLANS_READ',
  'PLANS_UPDATE',
  'PLANS_DELETE',
  'PLANS_APPROVE',
  'DEBTS_VIEW',
  'DEBTS_CREATE',
  'DEBTS_READ',
  'DEBTS_UPDATE',
  'DEBTS_DELETE',
] as const;

const SYSTEM_PERMISSIONS = [
  'FILES_UPLOAD',
  'AUDITS_READ',
] as const;

export const permissionGroups = [
  { label: 'Pessoas', permissions: PEOPLE_PERMISSIONS },
  { label: 'Conteúdo', permissions: CONTENT_PERMISSIONS },
  { label: 'Operações', permissions: OPERATIONS_PERMISSIONS },
  { label: 'Gestão', permissions: MANAGEMENT_PERMISSIONS },
  { label: 'Sistema', permissions: SYSTEM_PERMISSIONS },
] as const;

export const systemPermissions = [
  ...PEOPLE_PERMISSIONS,
  ...CONTENT_PERMISSIONS,
  ...OPERATIONS_PERMISSIONS,
  ...MANAGEMENT_PERMISSIONS,
  ...SYSTEM_PERMISSIONS,
] as const;

export type SystemPermission = (typeof systemPermissions)[number];

export function formatSystemPermission(permission: SystemPermission) {
  return permission
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}