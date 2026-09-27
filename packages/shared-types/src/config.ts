import { z } from 'zod';

export const platformSchema = z.enum(['android', 'ios', 'web']);
export type Platform = z.infer<typeof platformSchema>;

/** Flag keys are `<module>.<feature>`, e.g. `mandir.community_upload`. */
export const flagKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'Use <module>.<feature> in snake_case');

/** Reserved flag row whose `payload` holds remote config values (see docs/01-architecture.md §4). */
export const REMOTE_CONFIG_FLAG_KEY = 'app.remote_config';

/** A feature flag row as stored/edited by admin. */
export const featureFlagSchema = z.object({
  key: flagKeySchema,
  enabled: z.boolean(),
  rolloutPercent: z.number().int().min(0).max(100),
  /** Empty = all platforms. */
  platforms: z.array(platformSchema),
  /** Semver, e.g. "1.2.0". Null = any version. */
  minAppVersion: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
});
export type FeatureFlag = z.infer<typeof featureFlagSchema>;

/** A flag after evaluation for one user/platform/version. */
export const evaluatedFlagSchema = z.object({
  enabled: z.boolean(),
  payload: z.record(z.string(), z.unknown()).nullable(),
});
export type EvaluatedFlag = z.infer<typeof evaluatedFlagSchema>;

/** Remote config: typed core keys; modules may add more keys (documented in their module docs). */
export const remoteConfigSchema = z.looseObject({
  minSupportedAppVersion: z.string(),
  supportWhatsapp: z.string().nullable(),
});
export type RemoteConfig = z.infer<typeof remoteConfigSchema>;

/** `GET /v1/config` payload (inside `{ data }`). */
export const appConfigSchema = z.object({
  flags: z.record(z.string(), evaluatedFlagSchema),
  remoteConfig: remoteConfigSchema,
  /** True when the caller's app version is below `minSupportedAppVersion`. */
  forceUpdate: z.boolean(),
  serverTime: z.iso.datetime(),
});
export type AppConfig = z.infer<typeof appConfigSchema>;
