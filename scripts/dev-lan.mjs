#!/usr/bin/env node
/**
 * Points local dev at this computer's LAN IP so a real phone on the same WiFi can reach the API and
 * storage ("localhost" on the phone is the phone itself).
 *
 *   pnpm dev:lan              # detect the LAN IP
 *   pnpm dev:lan 192.168.1.20 # or pass it
 *
 * Writes:
 *   apps/api/.env               CDN_BASE_URL, S3_PUBLIC_ENDPOINT (S3_ENDPOINT stays localhost: the API itself)
 *   apps/devotee-app/.env.local API_URL
 * Restart the API and the Expo dev server afterwards. Run again whenever the IP changes.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = 4000;
const S3_PORT = 9000;

function isPrivateLan(ip) {
  return /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

function detectIp() {
  const candidates = Object.entries(networkInterfaces())
    // Skip virtual adapters (WSL, Hyper-V, Docker, VirtualBox, VPNs) — the phone cannot reach them.
    .filter(([name]) => !/vEthernet|WSL|Hyper-V|docker|VirtualBox|VMware|vbox|utun|tailscale|zt/i.test(name))
    .flatMap(([name, addrs]) =>
      (addrs ?? []).filter((a) => a.family === 'IPv4' && !a.internal).map((a) => ({ name, ip: a.address })),
    )
    .filter((c) => isPrivateLan(c.ip));
  // Prefer WiFi, then 192.168.x (typical home routers).
  candidates.sort(
    (a, b) =>
      Number(/wi-?fi|wlan|wireless/i.test(b.name)) - Number(/wi-?fi|wlan|wireless/i.test(a.name)) ||
      Number(b.ip.startsWith('192.168.')) - Number(a.ip.startsWith('192.168.')),
  );
  return candidates;
}

/** Sets `KEY=value` lines, replacing existing (even commented-out) ones; appends missing keys. */
function upsertEnv(file, values) {
  let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    // `[ \t]`, not `\s`: it must not cross line breaks (CRLF files: JS `^` also matches after `\r`).
    const re = new RegExp(`^#?[ \\t]*${key}=[^\\r\\n]*`, 'm');
    text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith('\n') ? eol : ''}${line}${eol}`;
  }
  writeFileSync(file, text);
}

const arg = process.argv[2];
const candidates = detectIp();
const ip = arg ?? candidates[0]?.ip;
if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
  console.error('Could not detect a LAN IPv4 address. Pass it explicitly: pnpm dev:lan 192.168.1.20');
  process.exit(1);
}

const apiEnv = join(root, 'apps/api/.env');
if (!existsSync(apiEnv)) {
  console.error('apps/api/.env is missing — copy apps/api/.env.example first.');
  process.exit(1);
}
const bucket = /^S3_PUBLIC_BUCKET=(.+)$/m.exec(readFileSync(apiEnv, 'utf8'))?.[1]?.trim() ?? 'media-public';

upsertEnv(apiEnv, {
  CDN_BASE_URL: `http://${ip}:${S3_PORT}/${bucket}`,
  S3_PUBLIC_ENDPOINT: `http://${ip}:${S3_PORT}`,
});
upsertEnv(join(root, 'apps/devotee-app/.env.local'), { API_URL: `http://${ip}:${API_PORT}` });

console.log(`LAN IP: ${ip}${arg ? '' : ` (${candidates[0].name})`}`);
if (!arg && candidates.length > 1) {
  console.log(`Other candidates: ${candidates.slice(1).map((c) => `${c.ip} (${c.name})`).join(', ')}`);
}
console.log(`  API      http://${ip}:${API_PORT}/v1   (apps/devotee-app/.env.local API_URL)`);
console.log(`  Storage  http://${ip}:${S3_PORT}        (apps/api/.env CDN_BASE_URL, S3_PUBLIC_ENDPOINT)`);
console.log('Restart `pnpm dev:api` and `pnpm dev:app`. The phone must be on the same WiFi, and the');
console.log(`firewall must allow inbound TCP ${API_PORT}, ${S3_PORT} and 8081 (Metro) on private networks.`);
console.log('Note: image URLs are built per request, so no re-seed is needed.');
