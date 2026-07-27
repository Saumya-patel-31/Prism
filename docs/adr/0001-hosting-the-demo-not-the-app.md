# ADR 0001 — Host the demo, not the app

**Status:** Accepted
**Date:** 2026-07-26

## Context

Prism runs language models locally through Ollama and stores everything in a
SQLite file on the same machine. Its stated value is that no data leaves the
user's hardware.

That creates a distribution problem. The usual way to show a web project is a
live link, but there is no sensible way to give strangers a working Prism:
inference needs a GPU we would have to rent continuously, and routing other
people's documents through a server we operate contradicts the entire premise.

## Decision

Deploy **only a static demo bundle** to S3 + CloudFront. The application stays
self-hosted.

The demo is the real interface with a client-side layer that answers every
`/api/*` call from fixtures (`src/lib/demo/mockApi.ts`). Recorded responses are
re-streamed through real `ReadableStream`s, so streaming, model routing,
citations, and the throughput counters behave as they do against Ollama. No
component is aware of demo mode, so the demo exercises the same code paths as
production rather than a parallel mock UI.

Infrastructure is defined in Terraform (`infra/`) and published by GitHub
Actions using OIDC role assumption rather than a stored AWS access key.

## Consequences

**Good.** The public link costs nothing and stays inside the always-free tier.
The privacy claim survives, because we are not quietly running a hosted copy
that sees user data. The mock layer doubles as a fixture suite — it has already
caught two response-shape mismatches between endpoints and their consumers.

**Bad.** The demo can drift from real behaviour if fixtures are not updated
alongside API changes. Static export cannot coexist with route handlers or
proxy middleware, so `scripts/build-demo-static.mjs` moves them aside during
the build and restores them afterwards — a moving part that needs to keep
working.

**Accepted risk.** Visitors evaluate recorded output. The demo banner says so
plainly rather than implying live inference.

---

# Appendix — what a hosted, multi-tenant Prism would require

This is a design study, not something we operate. It exists to show the shape
of the problem if the privacy constraint were lifted for a team deployment
behind a company VPN.

## Inference is the whole cost question

Everything else is rounding error next to serving models.

| Option | Shape | Trade-off |
|---|---|---|
| **Amazon Bedrock** | Managed models, per-token pricing | No servers, scales to zero, but the models are no longer yours and prompts leave your account boundary |
| **GPU on ECS/EC2** (`g5.xlarge`) | Self-managed Ollama or vLLM | Keeps weights and data in your VPC; roughly \$700–900/month per always-on instance |
| **SageMaker async endpoints** | Managed, queue-backed | Scales to zero between requests; cold starts of minutes are unacceptable for chat |

For a team that adopted Prism *because* of the privacy property, Bedrock
defeats the purpose. The honest answer is a small GPU pool in a private subnet,
with a queue in front so a burst of users degrades latency instead of failing.

## Everything else

- **App tier** — ECS Fargate behind an ALB. The app is a stateless Node process; two small tasks across AZs is enough.
- **Metadata** — Aurora Serverless v2 (PostgreSQL). SQLite is single-writer and file-local; it cannot back multiple tasks. Migrations port with little change since the schema is already versioned.
- **Documents** — S3 with SSE-KMS, one prefix per tenant, presigned URLs for upload so files never transit the app tier.
- **Vectors** — this is the real decision. Below roughly a million chunks, `pgvector` on the existing Aurora cluster avoids a second datastore entirely. Past that, OpenSearch Serverless. Prism's hybrid retrieval is BM25 + dense fused by RRF, and OpenSearch does both natively, so the fusion could move server-side.
- **Secrets** — Secrets Manager for `AUTH_SECRET` and database credentials, injected as task secrets rather than environment variables in the task definition.
- **Isolation** — every table is already scoped by `user_id`. Multi-tenancy would need that enforced at the query layer, not by convention, plus row-level security in Postgres as a backstop.

## What would have to change in the code

1. **Sessions.** HMAC-signed cookies with a per-user token version work on one node because the version is read from the same SQLite file. Across tasks that becomes a database read per request; it wants a short-TTL cache.
2. **Rate limiting.** `src/lib/rateLimit.ts` is an in-process `Map`. With N tasks the effective limit is N times the intended one. Needs ElastiCache or a DynamoDB counter.
3. **Embeddings.** Currently computed inline during upload. At scale this belongs in a queue-backed worker so a large PDF cannot occupy a request thread.
4. **Audit log.** Fine in SQLite for one user; would move to a dedicated store with retention rules.

## Why we are not doing it

A single-user local install has none of these problems, and solving them costs
several hundred dollars a month to serve an audience that explicitly wants
their data to stay on their own machine. The constraint is the product.
