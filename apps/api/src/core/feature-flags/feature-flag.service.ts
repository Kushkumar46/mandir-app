import { Injectable } from '@nestjs/common';
import {
  type AppConfig,
  type FeatureFlag,
  type Platform,
  REMOTE_CONFIG_FLAG_KEY,
  type RemoteConfig,
} from '@mandir/shared-types';

import { PrismaService } from '../prisma/prisma.module.js';
import { evaluateFlag, type FlagContext, isFlagOn, isVersionBelow } from './flag-evaluator.js';

const CACHE_TTL_MS = 30_000;

/** Code defaults; the `app.remote_config` flag payload overrides them. */
const REMOTE_CONFIG_DEFAULTS: RemoteConfig = {
  minSupportedAppVersion: '1.0.0',
  supportWhatsapp: null,
};

@Injectable()
export class FeatureFlagService {
  private cache: { flags: FeatureFlag[]; loadedAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** All flag rows (cached for 30s per API instance). */
  async all(): Promise<FeatureFlag[]> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) return this.cache.flags;
    const rows = await this.prisma.featureFlag.findMany();
    const flags: FeatureFlag[] = rows.map((r) => ({
      key: r.key,
      enabled: r.enabled,
      rolloutPercent: r.rolloutPercent,
      platforms: r.platforms as Platform[],
      minAppVersion: r.minAppVersion,
      payload: (r.payload as Record<string, unknown> | null) ?? null,
    }));
    this.cache = { flags, loadedAt: Date.now() };
    return flags;
  }

  /** Call after admin edits flags. */
  invalidate(): void {
    this.cache = null;
  }

  /** Unknown flags are OFF (new modules ship off until enabled from admin). */
  async isEnabled(key: string, ctx: FlagContext): Promise<boolean> {
    const flag = (await this.all()).find((f) => f.key === key);
    return !!flag && isFlagOn(flag, ctx);
  }

  async getAppConfig(ctx: FlagContext): Promise<AppConfig> {
    const all = await this.all();
    const flags: AppConfig['flags'] = {};
    let remoteConfig: RemoteConfig = { ...REMOTE_CONFIG_DEFAULTS };

    for (const flag of all) {
      if (flag.key === REMOTE_CONFIG_FLAG_KEY) {
        if (flag.enabled && flag.payload) remoteConfig = { ...remoteConfig, ...flag.payload };
        continue;
      }
      flags[flag.key] = evaluateFlag(flag, ctx);
    }

    return {
      flags,
      remoteConfig,
      forceUpdate: isVersionBelow(ctx.appVersion, remoteConfig.minSupportedAppVersion),
      serverTime: new Date().toISOString(),
    };
  }
}
