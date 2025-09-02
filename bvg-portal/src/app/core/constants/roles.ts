import rolesData from '../../../../../shared/roles.json';

export const Roles = rolesData;
export type Role = keyof typeof Roles;
export const ALLOWED_ASSIGNMENT_ROLES: Role[] = [
  Roles.AttendanceRegistrar,
  Roles.VoteRegistrar,
  Roles.ElectionObserver
];
