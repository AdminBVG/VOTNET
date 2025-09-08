import rolesData from '../../../../../shared/roles.json';

export const Roles = rolesData;
export type Role = keyof typeof Roles;
export const ALLOWED_ASSIGNMENT_ROLES: Role[] = [
  'AttendanceRegistrar',
  'VoteRegistrar',
  'ElectionObserver'
];

