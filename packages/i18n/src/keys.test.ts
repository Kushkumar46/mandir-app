import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { resources } from './index';

function keyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

test('en.json has exactly the same keys as hi.json', () => {
  assert.deepEqual(
    keyPaths(resources.en.translation).sort(),
    keyPaths(resources.hi.translation).sort(),
  );
});
