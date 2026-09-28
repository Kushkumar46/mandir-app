import { uuidV4 } from './uuid';

it('makes RFC 4122 v4 UUIDs (the API rejects other Idempotency-Keys)', () => {
  const keys = new Set(Array.from({ length: 200 }, uuidV4));
  expect(keys.size).toBe(200);
  for (const k of keys) expect(k).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
