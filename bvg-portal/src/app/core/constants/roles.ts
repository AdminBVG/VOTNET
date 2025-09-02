import rolesData from '../../../../../shared/roles.json';

export const Roles = rolesData as const;
export type Role = (typeof Roles)[keyof typeof Roles];
export const ALLOWED_ASSIGNMENT_ROLES: Role[] = [
  Roles.AttendanceRegistrar,
  Roles.VoteRegistrar,
  Roles.ElectionObserver
];
