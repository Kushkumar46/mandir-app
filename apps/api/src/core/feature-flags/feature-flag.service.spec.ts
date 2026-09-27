import type { PrismaService } from '../prisma/prisma.module.js';
import { FeatureFlagService } from './feature-flag.service.js';

const row = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  enabled: true,
  rolloutPercent: 100,
  platforms: [],
  minAppVersion: null,
  payload: null,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

function makeService(rows: ReturnType<typeof row>[]) {
  const findMany = vi.fn(async () => rows);
  const prisma = { featureFlag: { findMany } } as unknown as PrismaService;
  return { service: new FeatureFlagService(prisma), findMany };
}

describe('FeatureFlagService', () => {
  it('builds app config with remote config merged over defaults', async () => {
    const { service } = makeService([
      row('app.remote_config', { payload: { minSupportedAppVersion: '2.0.0', shareAppLink: 'x' } }),
      row('mandir.enabled'),
      row('mandir.festival_themes', { enabled: false }),
    ]);
    const cfg = await service.getAppConfig({ appVersion: '1.5.0' });
    expect(cfg.flags).toEqual({
      'mandir.enabled': { enabled: true, payload: null },
      'mandir.festival_themes': { enabled: false, payload: null },
    });
    expect(cfg.remoteConfig).toEqual({
      minSupportedAppVersion: '2.0.0',
      supportWhatsapp: null,
      shareAppLink: 'x',
    });
    expect(cfg.forceUpdate).toBe(true);
  });

  it('treats unknown flags as off', async () => {
    const { service } = makeService([]);
    await expect(service.isEnabled('mandir.nope', {})).resolves.toBe(false);
  });

  it('caches rows until invalidated', async () => {
    const { service, findMany } = makeService([row('a.b')]);
    await service.all();
    await service.all();
    expect(findMany).toHaveBeenCalledTimes(1);
    service.invalidate();
    await service.all();
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
