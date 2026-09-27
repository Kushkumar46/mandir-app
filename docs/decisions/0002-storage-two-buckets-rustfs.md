# ADR 0002 — Two storage buckets; RustFS for local S3

- **Status:** Accepted
- **Date:** 2026-09-27
- **Supersedes:** "MinIO locally" in CLAUDE.md §3 and the single-bucket prefix layout in docs/01 §6

## Context

1. MinIO no longer publishes community Docker images: `minio/minio` and `quay.io/minio/minio`
   (including pinned releases) cannot be pulled, so `pnpm dev:infra` failed.
2. The original design used one bucket with public and private prefixes. In production,
   Cloudflare R2 public access (r2.dev / custom domain) is enabled **per bucket, not per prefix**,
   so the single-bucket layout could not be reproduced in production — and local dev (where
   prefix-scoped anonymous read was possible) would behave differently from production.

## Decision

- **Two buckets** per environment:
  - `media-public` — `official/`, `community/public/`, `audio/`, `lyrics/`, `themes/`; public read via CDN.
  - `media-private` — `community/pending/`, `home-mandir/`; never public, short-lived signed GET URLs only.
- Object keys keep their prefixes; `StorageService.bucketFor(key)` maps prefix → bucket. Approval copies
  across buckets (`media-private/community/pending/…` → `media-public/community/public/…`).
- Env: `S3_PUBLIC_BUCKET`, `S3_PRIVATE_BUCKET` (must differ); `CDN_BASE_URL` points at the public bucket.
- **Local S3 server: RustFS** (`rustfs/rustfs`, Apache-2.0, S3 + bucket-policy compatible). A one-shot
  `s3-init` container (aws-cli) creates both buckets and applies an anonymous `s3:GetObject` policy to
  `media-public` only.

Alternatives considered: SeaweedFS (mature, but anonymous read config is coarser),
`bitnamilegacy/minio` (frozen, unmaintained image).

## Consequences

- Local and production share the same public/private boundary: a private object can't become public
  by a prefix mistake — it must be copied to the other bucket.
- RustFS is pre-1.0; it is only used for local development. If it misbehaves, any S3-compatible server
  that supports bucket policies can replace it with no code changes (only docker-compose).
- Production setup: create two R2 buckets per environment; enable the custom domain on the public one only.
