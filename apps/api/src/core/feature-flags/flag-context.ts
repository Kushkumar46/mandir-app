import { Header, platformSchema } from '@mandir/shared-types';
import type { Request } from 'express';

import type { AuthUser } from '../auth/auth.decorators.js';
import type { FlagContext } from './flag-evaluator.js';

export function flagContextFromRequest(req: Request & { user?: AuthUser }): FlagContext {
  const platform = platformSchema.safeParse(req.header(Header.PLATFORM)?.toLowerCase());
  return {
    userId: req.user?.id,
    platform: platform.success ? platform.data : undefined,
    appVersion: req.header(Header.APP_VERSION) || undefined,
  };
}
