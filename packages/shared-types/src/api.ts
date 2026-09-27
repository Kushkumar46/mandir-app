import { z } from 'zod';

/** Success envelope: `{ "data": <payload> }` */
export const apiResponseSchema = <T extends z.ZodType>(data: T) => z.object({ data });
export type ApiResponse<T> = { data: T };

/** Paginated envelope: `{ "data": [...], "nextCursor": "..." | null }` */
export const paginatedResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), nextCursor: z.string().nullable() });
export type PaginatedResponse<T> = { data: T[]; nextCursor: string | null };

export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 50;

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Error envelope: `{ "error": { "code", "message", "details" } }` */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).default({}),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const uuidSchema = z.uuid();
