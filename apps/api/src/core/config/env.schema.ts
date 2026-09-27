import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
    PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),

    DEV_AUTH: booleanString,

    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default('auto'),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    /** Public-read bucket (CDN): official/, community/public/, audio/, lyrics/, themes/ */
    S3_PUBLIC_BUCKET: z.string().min(1),
    /** Never public (signed URLs only): community/pending/, home-mandir/ */
    S3_PRIVATE_BUCKET: z.string().min(1),
    S3_FORCE_PATH_STYLE: booleanString,
    CDN_BASE_URL: z.url().transform((u) => u.replace(/\/+$/, '')),

    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((s) =>
        s
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      ),
  })
  .superRefine((env, ctx) => {
    if (env.S3_PUBLIC_BUCKET === env.S3_PRIVATE_BUCKET) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_PRIVATE_BUCKET'],
        message: 'Public and private buckets must be different',
      });
    }
    if (env.DEV_AUTH && (env.NODE_ENV === 'production' || env.APP_ENV === 'production')) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_AUTH'],
        message: 'DEV_AUTH must never be enabled in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Parses env vars; throws a readable error listing every invalid variable. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
