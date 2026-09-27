import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@mandir/shared-types';

import { AppException } from '../../core/errors/app.exception.js';
import type { PrismaService } from '../../core/prisma/prisma.module.js';
import type { Deity } from '../../generated/prisma/client.js';

/** The deity if it exists and is active, else 404 `DEITY_NOT_AVAILABLE`. */
export async function findActiveDeity(db: Pick<PrismaService, 'deity'>, deityId: string): Promise<Deity> {
  const deity = await db.deity.findUnique({ where: { id: deityId } });
  if (!deity?.isActive) throw deityNotAvailable({ deityId });
  return deity;
}

export function deityNotAvailable(details: Record<string, unknown>) {
  return new AppException(ErrorCode.DEITY_NOT_AVAILABLE, 'Deity not available', HttpStatus.NOT_FOUND, details);
}
