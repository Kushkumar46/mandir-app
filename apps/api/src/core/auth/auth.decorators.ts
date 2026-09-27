import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@mandir/shared-types';

export interface AuthUser {
  id: string;
  role: Role;
  timezone: string;
  language: string;
}

export const IS_PUBLIC = 'auth:isPublic';
export const IS_OPTIONAL_AUTH = 'auth:isOptional';
export const ROLES = 'auth:roles';

/** No authentication at all (health checks, webhooks with their own signature checks). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Authenticate if credentials are present, otherwise continue anonymously. */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH, true);

/** Restrict a route/controller to roles. Admin controllers use `@Roles('ADMIN')`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** The authenticated user (or `undefined` on `@OptionalAuth()` routes). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user,
);
