# Feature modules

One folder per module (`mandir/`, `coins/`, `images/`, `streaks/`, `admin/` …), added by each
module's build tasks — see `docs/modules/`.

Each module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/` (re-exports zod schemas from
`@mandir/shared-types`), `*.spec.ts`, `README.md`. Register the module in `src/app.module.ts`.

Core building blocks (`src/core/`):

| Need | Use |
|---|---|
| Current user | `@CurrentUser() user: AuthUser` |
| Anonymous access | `@Public()` (no auth) or `@OptionalAuth()` |
| Admin-only | `@Roles('ADMIN')` on the controller (routes under `/v1/admin/...`) |
| Feature flag | `@RequireFlag('mandir.enabled')` on controller or route |
| Spends coins/money | `@Idempotent()` (requires `Idempotency-Key` header) |
| Errors | `throw new AppException(ErrorCode.X, 'message', HttpStatus.Y, details)` |
| Validation | `@Body(new ZodValidationPipe(schema))` |
| Lists | `return paginated(items, nextCursor)` |
| Files | `StorageService` (presign PUT/GET, `publicUrl`) |
| Jobs | `BullModule.registerQueue({ name })` + `@Processor` |

Prisma convention: models in PascalCase with camelCase fields; tables and columns in snake_case via
`@@map` / `@map`.
