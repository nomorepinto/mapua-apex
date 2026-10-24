/** Admin calling a student route with no org claim uses this org id. */
export const ADMIN_DEFAULT_ORGANIZATION_ID = 'admin-org';

/** Admin calling a signatory route with no signatory claim uses this desk. */
export const ADMIN_DEFAULT_SIGNATORY_ID =
  '22734f67-3f9f-4ffd-9d44-0aceab2c0497';

export type RouteRole =
  'student' | 'signatory' | 'admin' | 'super_admin' | 'any';

export interface AuthenticatedCaller {
  sub: string;
  email: string;
  name: string;
  role: string;
  groups: string[];
  normalizedGroups: string[];
  isAdmin: boolean;
  mayImpersonateSignatory: boolean;
  /** Claim or admin header. Defaults are applied by the param decorators. */
  organizationId: string | null;
  signatoryId: string | null;
  claims: Record<string, unknown>;
  tokenUse: string | null;
}

export const ROUTE_GROUPS: Record<
  Exclude<RouteRole, 'any'>,
  readonly string[]
> = {
  student: ['student', 'students', 'org_submitter', 'admin', 'super_admin'],
  signatory: [
    'signatory',
    'signatories',
    'org_adviser',
    'dean',
    'cdm_reviewer',
    'cdm',
    'osaar',
    'admin',
    'super_admin',
  ],
  admin: ['admin', 'osaar', 'cdm_reviewer', 'cdm', 'super_admin'],
  super_admin: ['super_admin'],
};

export function mayAccessRole(
  role: RouteRole,
  normalizedGroups: readonly string[],
): boolean {
  if (role === 'any') {
    return true;
  }
  const allowed = ROUTE_GROUPS[role];
  return allowed.some((group) => normalizedGroups.includes(group));
}

export function deriveUserRole(
  normalizedGroups: readonly string[],
  isAdmin: boolean,
): string {
  if (isAdmin) {
    return 'admin';
  }
  const signatoryGroups = [
    'signatory',
    'signatories',
    'org_adviser',
    'dean',
    'cdm_reviewer',
    'cdm',
    'osaar',
  ];
  if (normalizedGroups.some((group) => signatoryGroups.includes(group))) {
    return 'signatory';
  }
  return 'student';
}
