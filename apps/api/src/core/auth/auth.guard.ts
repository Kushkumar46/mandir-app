import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Header, type Role } from '@mandir/shared-types';
import type { Request } from 'express';

import { AppConfigService } from '../config/config.module.js';
import { AppException } from '../errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { type AuthUser, IS_OPTIONAL_AUTH, IS_PUBLIC, ROLES } from './auth.decorators.js';
import { resolveDevUserId } from './dev-users.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Global auth guard. Until the Auth module exists it only understands the DEV_AUTH stub
 * (`X-Dev-User` header, docs/01-architecture.md §5). The Auth module will add JWT
 * verification here (Bearer access token) and keep the same `request.user` contract.
 * Also enforces `@Roles()` (AdminGuard behaviour).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    if (config.env.DEV_AUTH) {
      this.logger.warn('DEV_AUTH is ON — X-Dev-User header authenticates requests');
    }
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    req.user = await this.authenticate(req);

    if (!req.user) {
      if (this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH, targets)) return true;
      throw AppException.unauthenticated();
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles?.length && !roles.includes(req.user.role)) {
      throw AppException.forbidden('Insufficient role');
    }
    return true;
  }

  private async authenticate(req: Request): Promise<AuthUser | undefined> {
    const devHeader = req.header(Header.DEV_USER);
    if (!devHeader) return undefined; // JWT verification arrives with the Auth module.
    if (!this.config.env.DEV_AUTH) throw AppException.unauthenticated('DEV_AUTH is disabled');

    const id = resolveDevUserId(devHeader);
    if (!UUID.test(id)) throw AppException.unauthenticated('Unknown dev user');
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, timezone: true, language: true },
    });
    if (!user) throw AppException.unauthenticated('Unknown dev user (did you run pnpm db:seed?)');
    return user;
  }
}
