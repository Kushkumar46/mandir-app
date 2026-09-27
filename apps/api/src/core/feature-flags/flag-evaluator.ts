import { createHash } from 'node:crypto';

import type { EvaluatedFlag, FeatureFlag, Platform } from '@mandir/shared-types';
import semver from 'semver';

export interface FlagContext {
  userId?: string;
  platform?: Platform;
  /** Semver of the calling app build; undefined for admin-web / unknown clients. */
  appVersion?: string;
}

/** Stable 0–99 bucket for a user+flag: `hash(userId + key) % 100` (docs/01-architecture.md §4). */
export function rolloutBucket(userId: string, key: string): number {
  return createHash('sha256').update(userId + key).digest().readUInt32BE(0) % 100;
}

/** True when `version` is a valid semver below `min`. Unknown versions are not blocked. */
export function isVersionBelow(version: string | undefined, min: string | null | undefined): boolean {
  if (!version || !min) return false;
  const v = semver.coerce(version);
  const m = semver.coerce(min);
  return !!v && !!m && semver.lt(v, m);
}

export function isFlagOn(flag: FeatureFlag, ctx: FlagContext): boolean {
  if (!flag.enabled) return false;
  if (flag.platforms.length > 0 && (!ctx.platform || !flag.platforms.includes(ctx.platform))) {
    return false;
  }
  if (flag.minAppVersion && ctx.appVersion && isVersionBelow(ctx.appVersion, flag.minAppVersion)) {
    return false;
  }
  if (flag.rolloutPercent >= 100) return true;
  if (flag.rolloutPercent <= 0 || !ctx.userId) return false; // anonymous: only 100% flags
  return rolloutBucket(ctx.userId, flag.key) < flag.rolloutPercent;
}

export function evaluateFlag(flag: FeatureFlag, ctx: FlagContext): EvaluatedFlag {
  const enabled = isFlagOn(flag, ctx);
  return { enabled, payload: enabled ? flag.payload : null };
}
