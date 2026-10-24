import type { AuthenticatedCaller } from '../common/caller.js';

declare module 'express-serve-static-core' {
  interface Request {
    caller?: AuthenticatedCaller;
    arcusOrganizationId?: string | null;
  }
}

export {};
