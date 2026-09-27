import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AppConfigService } from '../config/config.module.js';
import { AppException } from '../errors/app.exception.js';
import type { PrismaService } from '../prisma/prisma.module.js';
import { IS_OPTIONAL_AUTH, IS_PUBLIC, ROLES } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';
import { DEV_USERS } from './dev-users.js';

const users: Record<string, { id: string; role: string; timezone: string; language: string }> = {
  [DEV_USERS['dev-user'].id]: { id: DEV_USERS['dev-user'].id, role: 'USER', timezone: 'Asia/Kolkata', language: 'hi' },
  [DEV_USERS['dev-admin'].id]: { id: DEV_USERS['dev-admin'].id, role: 'ADMIN', timezone: 'Asia/Kolkata', language: 'hi' },
};

function setup(opts: { devAuth: boolean; meta?: Record<string, unknown> }) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
    (key: unknown) => (opts.meta ?? {})[key as string],
  );
  const config = { env: { DEV_AUTH: opts.devAuth } } as AppConfigService;
  const prisma = {
    user: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => users[where.id] ?? null) },
  } as unknown as PrismaService;
  return new AuthGuard(reflector, config, prisma);
}

function ctx(headers: Record<string, string> = {}) {
  const req: { user?: unknown; header: (n: string) => string | undefined } = {
    header: (n) => headers[n.toLowerCase()],
  };
  const context = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { context, req };
}

describe('AuthGuard (DEV_AUTH stub)', () => {
  it('authenticates X-Dev-User alias when DEV_AUTH is on', async () => {
    const { context, req } = ctx({ 'x-dev-user': 'dev-user' });
    await expect(setup({ devAuth: true }).canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: DEV_USERS['dev-user'].id, role: 'USER' });
  });

  it('rejects X-Dev-User when DEV_AUTH is off', async () => {
    const { context } = ctx({ 'x-dev-user': 'dev-user' });
    await expect(setup({ devAuth: false }).canActivate(context)).rejects.toBeInstanceOf(AppException);
  });

  it('rejects unknown users and missing credentials', async () => {
    await expect(setup({ devAuth: true }).canActivate(ctx({ 'x-dev-user': 'nobody' }).context)).rejects.toThrow();
    await expect(setup({ devAuth: true }).canActivate(ctx().context)).rejects.toThrow(/Authentication required/);
  });

  it('allows anonymous access on @Public and @OptionalAuth routes', async () => {
    await expect(setup({ devAuth: true, meta: { [IS_PUBLIC]: true } }).canActivate(ctx().context)).resolves.toBe(true);
    await expect(setup({ devAuth: true, meta: { [IS_OPTIONAL_AUTH]: true } }).canActivate(ctx().context)).resolves.toBe(true);
  });

  it('enforces @Roles', async () => {
    const guard = setup({ devAuth: true, meta: { [ROLES]: ['ADMIN'] } });
    await expect(guard.canActivate(ctx({ 'x-dev-user': 'dev-user' }).context)).rejects.toThrow(/Insufficient role/);
    await expect(guard.canActivate(ctx({ 'x-dev-user': 'dev-admin' }).context)).resolves.toBe(true);
  });
});
