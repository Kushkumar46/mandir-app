'use client';

import type { AppConfig } from '@mandir/shared-types';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';

/** Foundation dashboard: shows API connectivity and evaluated flags. Real admin screens come in T20+. */
export default function Home() {
  const config = useQuery({ queryKey: ['config'], queryFn: () => apiFetch<AppConfig>('/config') });

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="text-2xl font-semibold text-maroon">Mandir Admin</h1>

      <section className="mt-6 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">API</h2>
          <Button variant="outline" size="sm" onClick={() => void config.refetch()}>
            Refresh
          </Button>
        </div>
        {config.isPending && <p className="text-muted-foreground">Connecting…</p>}
        {config.isError && (
          <p className="text-destructive">
            Cannot reach the API: {config.error.message}. Is <code>pnpm dev:api</code> running?
          </p>
        )}
        {config.data && (
          <>
            <p className="text-success">Connected · server time {config.data.serverTime}</p>
            <h3 className="mt-4 font-medium">Feature flags</h3>
            {Object.keys(config.data.flags).length === 0 ? (
              <p className="text-muted-foreground">No flags yet (modules add them).</p>
            ) : (
              <ul className="mt-2 space-y-1 font-mono text-sm">
                {Object.entries(config.data.flags).map(([key, flag]) => (
                  <li key={key}>
                    {flag.enabled ? '🟢' : '⚪'} {key}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-4 font-medium">Remote config</h3>
            <pre className="mt-2 overflow-x-auto rounded bg-cream p-3 text-sm">
              {JSON.stringify(config.data.remoteConfig, null, 2)}
            </pre>
          </>
        )}
      </section>
    </main>
  );
}
