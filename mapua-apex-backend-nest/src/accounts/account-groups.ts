/** Logical Cognito group for each signatory role the OSAAR desk can assign. */
export const SIGNATORY_GROUP_BY_ROLE: Readonly<Record<string, string>> = {
  dean: 'dean',
  adviser: 'org_adviser',
  cdm: 'cdm_reviewer',
  osaar: 'osaar',
};

export const ORGANIZATION_GROUP = 'org_submitter';

/** Groups this feature may add or remove. Admin groups are never in this set. */
export const MANAGED_GROUPS: readonly string[] = [
  ...Object.values(SIGNATORY_GROUP_BY_ROLE),
  ORGANIZATION_GROUP,
];

export const SIGNATORY_ATTRIBUTE = 'custom:signatory_id';
export const ORGANIZATION_ATTRIBUTE = 'custom:organization_id';
