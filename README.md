# EscrowVault

A working miniature of a **software-escrow portal** — the web app vendors,
beneficiaries, escrow agents, and auditors use to manage agreements, deposits,
verification, release claims, and resilience certificates.

Built as a full-stack JavaScript portfolio piece (Next.js App Router +
GraphQL/Apollo + Prisma/Postgres + Auth.js/Auth0 + Tailwind + AWS-shaped
storage), with the domain modeled on real escrow practice: deposits,
Validated → Verified → Certified verification tiers, contractual release
triggers with a dispute window, and maker-checker release decisions.

Architecture with diagrams: [`docs/architecture.md`](docs/architecture.md).

## Stack

| Layer | Choice |
|---|---|
| UI | Next.js 16 App Router (RSC-first), React 19, Tailwind v4 |
| API | Apollo Server route handler + Server Actions + Route Handlers |
| DB | PostgreSQL 16 + Prisma 6 (migrations, seed) |
| Auth | Auth.js v5 + Auth0 OIDC, JWT sessions, role/tenant in session |
| Storage | S3 API (AWS in prod, S3Mock locally), presigned uploads, Lambda scan worker |
| Charts | Chart.js via react-chartjs-2 (Apollo Client dashboard) |
| Tests | Vitest + RTL (unit), tsx smoke scripts (services), Playwright (e2e) |
| CI | GitHub Actions (lint/unit + DB/S3/build/e2e), Vercel-ready |

## Quickstart

Prerequisites: Node 22, pnpm 10, Docker Desktop.

```powershell
pnpm install
pnpm db:up            # Postgres :5433 + S3Mock :9090 + versioned bucket
pnpm db:migrate       # apply migrations
pnpm db:seed          # demo tenant: 1 agreement, 4 role users, deposit, cert
pnpm dev              # http://localhost:3000
```

Background workers (separate shells):

```powershell
pnpm worker:scan      # integrity scan: hash-verify pending uploads
pnpm worker:verify    # execute queued verification runs
```

## Scripts

| Script | Purpose |
|---|---|
| `dev` / `build` / `start` / `lint` | Next.js lifecycle |
| `db:up` / `db:down` | compose stack |
| `db:migrate` / `db:seed` / `db:studio` | Prisma workflow |
| `test` / `test:watch` | Vitest unit suite (14 tests, no DB) |
| `test:e2e` | Playwright (needs build + seeded DB) |
| `smoke:m3` / `smoke:m4` / `smoke:m5` | service-level lifecycle proofs (need DB + S3) |
| `worker:scan` / `worker:verify` | local stand-ins for the Lambda / scheduler |

## Auth0 setup (5 minutes, unlocks login)

Without this, everything builds and all automated tests pass, but sign-in has
no provider and `/portal/*` redirects to it.

1. Create a free tenant at auth0.com → Applications → **Regular Web Application**.
2. Allowed Callback URLs: `http://localhost:3000/api/auth/callback/auth0`
   (add `https://<vercel-app>.vercel.app/api/auth/callback/auth0` for preview/prod).
3. Allowed Logout URLs + Web Origins: your app URLs.
4. Copy Client ID / Secret / Domain into `.env`:
   `AUTH_AUTH0_ID`, `AUTH_AUTH0_SECRET`, `AUTH_AUTH0_ISSUER=https://<tenant>.auth0.com`.
5. Point the seeded users at real Auth0 `sub`s:
   `UPDATE "User" SET "auth0Sub"='<sub>' WHERE email='<role>@demo.test';`
   (roles: `depositor`, `agent`, `beneficiary`, `auditor` @demo.test).

## 90-second demo script

1. **Public trust (0:00):** open `/verify/CERT-2026-0001` — a prerendered
   resilience certificate, no login.
2. **Deposit (0:15):** sign in as `depositor@demo.test` → Deposits → New
   deposit → upload 3 typed files (watch SCAN PASS) → Activate.
3. **Verify (0:40):** sign in as `agent@demo.test` → deposit → Escalate to
   VALIDATED → run detail → Execute → certificate issued. Repeat to CERTIFIED
   and sign off the human build test.
4. **Release (1:00):** sign in as `beneficiary@demo.test` → file a
   SUPPORT_FAILURE claim → as agent, notify (dispute window opens) → as
   depositor, dispute → as the *notifying* agent try to decide (409
   maker-checker) → second agent approves → record delivery.
5. **Health (1:20):** portal home dashboard (GraphQL + charts) and the audit
   timeline.

## Testing

| Layer | Tool | What | Needs |
|---|---|---|---|
| Unit | Vitest + RTL | error taxonomy, filename hygiene, tier ladder, chart builders, upload form (mocked fetch) | nothing |
| Service | tsx smoke scripts | GraphQL RBAC/isolation, upload→scan loop, tier lifecycle, claim lifecycle + maker-checker | DB + S3 |
| E2E | Playwright | public pages, auth gates, 401 codes, certificate pages | build + seeded DB |
| CI | `.github/workflows/ci.yml` | lint/unit job + full-stack job (services, migrate, seed, smokes, build, browsers, e2e) | GitHub |

The authenticated browser happy path is committed as skipped specs in
`tests/e2e/authed-lifecycle.spec.ts` — enable once Auth0 is wired.

## Project structure

```
src/
  app/            (marketing)/ + (portal)/ + api/ + verify/[serial]/
  components/     (co-located *.client.tsx at interactivity leaves)
  graphql/        typeDefs, resolvers, dataloaders, context
  services/       deposits, verification, releases, uploads, scan, audit, errors
  state/          SessionProvider + tenant/role React Context
  lib/            prisma, s3, env (zod), rbac, apollo-client, http-errors
  proxy.ts        edge fast-path redirect (Next 16 proxy convention)
prisma/           schema, migrations, seed
tests/            unit/ (vitest) e2e/ (playwright) smoke/ (tsx)
scripts/          lambda-stub, verify-runs (local worker stand-ins)
docs/             architecture.md (+ diagrams)
```

Layer rules: `services/` alone owns business rules and the Prisma client;
client components never import env/Prisma/AWS SDKs; every query scopes by the
session's `tenantId`.

## Where the job-description items live

Required: TypeScript + React Context (`state/providers.tsx`), Next.js App
Router (RSC pages, actions, route handlers, `use cache`, partial prerender),
GraphQL/Apollo (server route + client dashboard + DataLoader), Tailwind,
Git (conventional commits per milestone), Playwright + Vitest/RTL,
PostgreSQL + Prisma, Auth.js + Auth0, RBAC roles on every mutation.
Nice-to-have: Lambda + S3 (worker scripts share the exact services the AWS
counterparts will call), GitHub Actions CI, Chart.js dashboards. AWS deploy
notes are in “Deployment” below.

## Deployment

**Vercel (app):** import the repo, set env vars (`DATABASE_URL` → hosted
Postgres e.g. Neon/Supabase, `AUTH_*`, `S3_*` → AWS, `NEXT_PUBLIC_APP_URL`),
deploy. Preview deploys per PR work unchanged.

**AWS (storage/compute):** create the `escrow-deposits` bucket (versioned,
SSE-S3); deploy `aws/lambda/deposit-scan` (planned, see architecture §9)
calling `scanPendingAssets()` on `s3:ObjectCreated`; point `S3_*` at it.
Local S3Mock accepts the same presigned URLs the SDK mints for AWS.

## License

MIT — see [LICENSE](LICENSE).
