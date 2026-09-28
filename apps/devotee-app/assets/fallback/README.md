# assets/fallback/

Bundled fallback assets for offline/first launch.

- `deity-fallback.webp` — generic diya scene shown when a deity has no image or it fails to load
  (Virtual Mandir VM-01). Regenerate with `node scripts/generate-fallback-art.cjs`.
- `bell-left.wav`, `bell-right.wav` — the two garbhagriha bells (§4.2), `shankh.wav` — first visit of
  the day (VM-01). Synthesised placeholders (uncompressed WAV so playback starts without decoding
  delay); regenerate with `node scripts/generate-fallback-sounds.cjs`, replace with clean recordings
  before launch (§12).
