export const Roles = {
  AttendanceRegistrar: 'AttendanceRegistrar',
  VoteRegistrar: 'VoteRegistrar',
  ElectionObserver: 'ElectionObserver'
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const ALLOWED_ASSIGNMENT_ROLES: Role[] = Object.values(Roles);
