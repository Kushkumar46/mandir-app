/**
 * Thin analytics wrapper (docs/01-architecture.md §9). The provider (PostHog or Firebase) is chosen
 * later; until then events go to the dev console (the "debug logger"). Event names are listed in
 * each module doc. Never put personal data (phone, name) in props.
 */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

type Sink = (event: string, props: AnalyticsProps) => void;

const devSink: Sink = (event, props) => {
  if (__DEV__ && process.env.NODE_ENV !== 'test') console.log('[analytics]', event, props);
};
let sink: Sink = devSink;

export function track(event: string, props: AnalyticsProps = {}) {
  try {
    sink(event, props);
  } catch {
    // Analytics must never break the app.
  }
}

/** Tests: capture events. Returns a function that restores the previous sink. */
export function setAnalyticsSink(next: Sink): () => void {
  const prev = sink;
  sink = next;
  return () => {
    sink = prev;
  };
}
