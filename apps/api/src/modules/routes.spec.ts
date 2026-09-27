import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';

import { CoinsController } from './coins/coins.controller.js';
import { DeitiesController } from './mandir/deities.controller.js';
import { MandirController } from './mandir/mandir.controller.js';
import { StreaksController } from './streaks/streaks.controller.js';

function routesOf(controller: Type): string[] {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && Reflect.hasMetadata(PATH_METADATA, proto[name] as object))
    .map((name) => {
      const handler = proto[name] as object;
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      return `${method} /${base}${path === '/' ? '' : `/${path}`}`;
    });
}

// docs/modules/01-virtual-mandir.md §7 "Mandir" + "Coins" (RevenueCat webhook comes with T15).
describe('Virtual Mandir route scaffolding', () => {
  it('registers every §7 Mandir and Coins route', () => {
    const routes = [MandirController, DeitiesController, CoinsController, StreaksController].flatMap(routesOf);
    expect(routes.sort()).toEqual(
      [
        'GET /mandir/home',
        'GET /deities',
        'PUT /mandir/deities',
        'PUT /mandir/deities/:deityId/image',
        'GET /deities/:deityId/offerings',
        'POST /mandir/offerings',
        'GET /deities/:deityId/aartis',
        'POST /mandir/rituals/aarti-complete',
        'POST /mandir/rituals/darshan',
        'GET /me/streak',
        'GET /coins/wallet',
        'GET /coins/transactions',
        'GET /coins/packs',
        'GET /coins/reward-rules',
      ].sort(),
    );
  });
});
