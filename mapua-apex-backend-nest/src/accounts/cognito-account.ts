export interface CognitoAccount {
  username: string;
  sub: string;
  email: string | null;
  name: string | null;
  signatoryId: string | null;
  organizationId: string | null;
  status: string | null;
}

export interface AccountView {
  username: string;
  sub: string;
  email: string | null;
  name: string | null;
  signatory_id: string | null;
  organization_id: string | null;
  status: string | null;
}
