# BioPay — Project Conventions

## What this is

BioPay is a Norwegian palm-payment digital wallet. Users register with BankID,
enroll their palm via PalmID SaaS, and pay in physical stores by holding their
hand over a PalmID terminal — no phone or card needed.

```
PalmID Terminal → webhook → BioPay API → Mangopay transfer → receipt in app
```

## Monorepo layout

```
apps/
  api/     Fastify REST API (port 3001) — webhooks, payments, auth
  web/     Next.js 15 (port 3000) — terminal simulator + landing page
  expo/    React Native Expo SDK 54 — iOS + Android mobile app

packages/
  db/      Prisma schema + generated client (@biopay/db)
  auth/    JWT sign/verify utilities using jose (@biopay/auth)
  ui/      shadcn/ui web components (@biopay/ui)
  config/  Shared ESLint, Prettier, Tailwind, TypeScript configs (@biopay/config)
```

## Commands

```bash
# Install everything
pnpm install

# Run all services simultaneously
pnpm dev                # api + web + expo

# Individual services
pnpm dev:api            # Fastify API on :3001
pnpm dev:web            # Next.js on :3000
pnpm dev:expo           # Expo / Metro bundler

# Database (runs against packages/db)
pnpm db:push            # Apply schema changes without migration file (dev only)
pnpm db:migrate         # Create and apply migration (production-safe)
pnpm db:generate        # Re-generate Prisma client after schema change
pnpm db:studio          # Open Prisma Studio in browser

# Code quality
pnpm build              # Build all apps
pnpm typecheck          # Type-check all packages
pnpm lint               # ESLint all packages
pnpm lint:fix           # Auto-fix lint errors
pnpm test               # Run all tests
```

## Environment setup

```bash
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and REDIS_URL
# Everything else has sensible defaults for mock mode
```

Required for all modes:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` + `JWT_REFRESH_SECRET` — 32+ byte random hex strings

Optional (omit to use mock mode):
- `BANKID_*` — BankID via Idura (free test env available immediately)
- `PALMID_*` — PalmID SaaS (requires commercial agreement)
- `MANGOPAY_*` — Mangopay wallet (sandbox available immediately)

## Mock mode (the default)

When `BANKID_CLIENT_ID`, `PALMID_API_KEY`, or `MANGOPAY_CLIENT_ID` are absent,
the corresponding provider automatically uses a mock implementation. The entire
system works end-to-end with all three mocks active.

### Full mock flow walkthrough

1. `pnpm install && pnpm db:push && pnpm dev`
2. Mobile: tap Login → a simple HTML form appears (mock BankID)
3. Enter any email + name → you're logged in, account created
4. Mobile: Palm tab → "Enroll Palm" → fake palmId stored
5. Browser: `http://localhost:3000/terminal`
6. Select merchant → enter 149 NOK → your user appears → tap "Scan"
7. Transaction processes → receipt shows in terminal
8. Mobile: balance decreased, transaction in history

### Mock behaviors

| Provider | Mock behavior |
|---|---|
| BankID | Simple HTML form at `/auth/bankid/mock-login` — no OIDC, no external calls |
| PalmID | Generates `mock_palm_<cuid>`, HMAC check always passes |
| Mangopay | All balance math in PostgreSQL, deposits succeed instantly |

## Architecture decisions

### Why Fastify REST (not tRPC)?
PalmID terminals and Mangopay send webhooks to plain HTTP endpoints. tRPC's
RPC contract is unsuitable for external callers. REST is correct here.

### Why custom JWT (not better-auth)?
BankID requires PKCE + OIDC with Norwegian-specific claims (PID/fødselsnummer).
We own the auth flow completely, including token rotation and session management.

### Why Prisma (not Drizzle)?
Specified in the project spec. Prisma migrations provide audit trails important
for financial data schema changes.

### Mangopay mock owns all money movement
In mock mode, `wallet.balance_cents` in PostgreSQL is the single source of truth.
In real mode, it becomes a cache synchronized by Mangopay webhooks.

## Key design patterns

### Idempotency (all POST /wallet/* routes)
All payment endpoints require an `Idempotency-Key` header (UUID).
Stored in Redis for 24h. Duplicate keys return cached response, no re-processing.
Generate client-side: `crypto.randomUUID()`

### Webhook security (POST /webhooks/palmid)
```
HMAC-SHA256 signature in X-PalmID-Signature: sha256=<hex>
Verified against raw request body BEFORE JSON parsing
Mock mode: signature check bypassed
```

### Refresh token rotation
Each refresh token use invalidates the old token and issues a new one.
This prevents replay attacks. Sessions are stored in the `sessions` table.

### Provider factory pattern
```typescript
// Each provider has: types.ts | mock.ts | real.ts | factory.ts
import { getBankIDProvider } from './providers/bankid/factory';
// Returns MockBankIDProvider if BANKID_CLIENT_ID is absent
// Returns RealBankIDProvider if BANKID_CLIENT_ID is set
```

## Adding a new API route

1. Create `apps/api/src/routes/<name>.ts`
2. Define Zod schemas for request + response
3. Register in `apps/api/src/index.ts`:
   ```typescript
   await app.register(myRoute, { prefix: '/v1' });
   ```
4. Add typed method to `apps/web/src/lib/api-client.ts`
5. Add typed method to `apps/expo/src/lib/api.ts`

## Naming conventions

| Context | Convention |
|---|---|
| Database columns | `snake_case` |
| TypeScript / JSON | `camelCase` |
| API route paths | `kebab-case` |
| Components | `PascalCase` |
| Env vars | `SCREAMING_SNAKE_CASE` |
| File names | `kebab-case.ts` |

## Testing

- Unit tests: `vitest` for provider logic and JWT utilities
- Integration tests: `vitest` + `@fastify/inject` for API routes (uses mock providers)
- E2E: use the terminal simulator at `http://localhost:3000/terminal`

## Critical path: PalmID payment webhook

`POST /webhooks/palmid` is the most important endpoint.
It MUST be:
1. **Idempotent** — check `transactions.idempotency_key` before any DB write
2. **Atomic** — wrap balance update + transaction creation in `prisma.$transaction()`
3. **Fast** — respond within 5–10s (PalmID terminal timeout)
4. **HMAC-validated** — before parsing the body

## Local infrastructure

Requires PostgreSQL and Redis running locally.
Recommended: `docker compose up -d` (see docker-compose.yml in root)
Or use managed services and update `DATABASE_URL` / `REDIS_URL` in `.env`.
