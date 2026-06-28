# Backend Fix Log — Root Cause Analysis

## Bug 1 — Config split: `src/config/index.ts` was dead code in production

### Root cause
Two config files existed simultaneously:
- `src/config.ts` — the **complete** config (had `internalApiKey`, `botBaseUrl`, `bcryptRounds`)
- `src/config/index.ts` — an **incomplete** copy (missing those three keys)

TypeScript module resolution: when both `src/config.ts` and `src/config/index.ts` exist, `import from './config'` in any TypeScript file resolves to `src/config.ts` (file beats directory). So **at compile time** every import got the correct complete config.

But `tsc` outputs to `dist/`. There is already a `dist/config/` directory (compiled from `src/config/`). There cannot also be a `dist/config.js` file at the same path. TypeScript silently dropped `src/config.ts` from the compiled output — no error, no warning.

**At runtime**, `require('./config')` in `dist/app.js` resolves to `dist/config/index.js` — the incomplete one. `config.whatsapp.internalApiKey` was always `undefined` in production.

### Consequence chain
- `config.whatsapp.internalApiKey` → `undefined`
- `internalAuth` middleware: in production (`isProd=true`) → `sendError(res, 503)`
- Every bot call to `/api/v1/internal/*` returned 503
- In development: `internalApiKey` was `undefined` so the key check was skipped entirely (the `!config.whatsapp.internalApiKey` branch called `next()`) — worked accidentally in dev, failed in prod

### Fix
`src/config/index.ts` now re-exports from `src/config.ts`:
```typescript
export { config } from '../config';
```
`src/config.ts` is the single source of truth. No duplication.

---

## Bug 2 — `INTERNAL_API_KEY=<your_secret>` placeholder was never replaced

### Root cause
The `.env` file shipped with a literal placeholder. Both bot and backend were reading `"<your_secret>"` as the key. In development the `internalAuth` bypass hid this; in production it caused 401s on all bot calls even once the config bug was fixed.

### Fix
`.env` updated with a real 64-character hex secret. The `.env.example` now documents exactly how to generate one.

**⚠️ Action required**: copy the new `INTERNAL_API_KEY` value from `.env` into your bot's `.env` as well. Both must match.

---

## Bug 3 — `authLimiter` blocked bot registration from shared IPs

### Root cause
The `authLimiter` (10 requests per 15 minutes) used IP-based rate limiting with no special handling for bot calls. On Render and Railway, the entire bot instance shares one outbound NAT IP. When multiple users register within 15 minutes, the 11th registration attempt is rejected with 429 — from the backend's perspective it's just another request from the same IP.

The bot receives 429, which it treats as a registration failure, queues a retry, and users see their account creation silently fail.

### Fix
`rateLimiter.middleware.ts` now exports a `skipInternal` function:
```typescript
const skipInternal = (req: Request): boolean => !!req.headers['x-internal-key'];
export const authLimiter = rateLimit({ ..., skip: skipInternal });
```
Internal requests (identified by the already-authenticated `X-Internal-Key` header) bypass the auth rate limiter. They have their own `internalLimiter` (300 req/min) applied at the route level.

---

## Bug 4 — Internal routes had no `register-customer` or `login` endpoints

### Root cause
The bot's registration flow correctly calls `POST /api/v1/auth/register/customer` (the public endpoint). But:
1. The public endpoint is behind `authLimiter` (see Bug 3)
2. The bot had no way to log in existing users — `/api/v1/auth/login` requires email+password, and the bot doesn't store passwords after registration completes

### Fix
Two new endpoints added to `internal.routes.ts`:

**`POST /api/v1/internal/register-customer`**
- Same body as public route: `{ fullName, email, phone, password }`
- Calls the same `authService.registerCustomer()` function — no duplicated logic
- Not subject to `authLimiter`

**`POST /api/v1/internal/login`**
- Body: `{ email, password }`
- Calls `authService.login()`
- Not subject to `authLimiter`

The bot's `backendClient.js` should be updated to prefer these internal endpoints over the public ones.

---

## Bug 5 — Missing Prisma migration for `artisans` and `bot_sessions`

### Root cause
Both tables are defined in `prisma/schema.prisma` but were **never included in any migration SQL file**. Running `prisma migrate deploy` on a fresh database would not create them. The tables only existed if the bot's `ensureSchema()` ran first — a fragile ordering dependency between two separate services.

### Fix
New migration: `prisma/migrations/20260626000000_bot_tables/migration.sql`
- Creates `artisans` with correct indexes
- Creates `bot_sessions` with correct JSONB NOT NULL defaults

Uses `CREATE TABLE IF NOT EXISTS` so it's safe to run even if the bot already created the tables.

---

## Bug 6 — `emailTemplates` was missing 3 methods used by other modules

### Root cause
`bookings.service.ts`, `reviews.service.ts`, and `inquiries.routes.ts` all imported and called `emailTemplates.bookingConfirmed`, `emailTemplates.reviewReceived`, and `emailTemplates.newInquiry`. These did not exist in `utils/email.ts`. TypeScript would have caught this, but `skipLibCheck: true` and the missing `@types/*` packages masked the error.

At runtime: `emailTemplates.bookingConfirmed is not a function` — email sending silently failed (it was already wrapped in try/catch) but would have thrown an unhandled error if the try/catch wasn't there.

### Fix
All three templates added to `emailTemplates` with correct signatures matching the call sites:
- `bookingConfirmed(customerName, providerName, scheduledAt)` — 3 args
- `reviewReceived(providerName, customerName, rating)` — rating is `number`
- `newInquiry(providerName, customerName, service)` — 3 args

---

## Bug 7 — Resend API configured but never used

### Root cause
`config.email.resendApiKey` was read from `RESEND_API_KEY` and stored in config, but `utils/email.ts` only ever used nodemailer (SMTP). The Resend key was set but did nothing.

### Fix
`sendEmail()` now checks for `config.email.resendApiKey` first and uses the Resend HTTP API (a direct `fetch` call — no extra package needed). SMTP/nodemailer is the fallback.

---

## Files changed

| File | What changed |
|---|---|
| `src/config/index.ts` | Re-exports from `src/config.ts` — eliminates the runtime/compile-time config split |
| `src/config.ts` | Added `paystack.webhookSecret`; confirmed as single source of truth |
| `src/middleware/internalAuth.middleware.ts` | Better error messages; documents the config bug fix |
| `src/middleware/rateLimiter.middleware.ts` | `skipInternal` on `authLimiter`; new `internalLimiter` for bot routes |
| `src/modules/internal/internal.routes.ts` | Added `POST /register-customer` and `POST /login`; added `internalLimiter` |
| `src/app.ts` | Uses `internalLimiter` on internal routes; cleaner CORS allowed-origins list |
| `src/utils/email.ts` | Uses Resend when configured; adds all 3 missing `emailTemplates` methods |
| `src/utils/whatsapp.ts` | No change needed |
| `tsconfig.json` | Added `ES2022` to `lib` (provides `fetch`, `AbortSignal` globally) |
| `package.json` | Added `start:prod` script (`prisma migrate deploy && node dist/server.js`) |
| `.env` | Replaced `<your_secret>` placeholder with a real generated key |
| `.env.example` | Full documentation of every variable with generation instructions |
| `prisma/migrations/20260626000000_bot_tables/migration.sql` | Creates `artisans` and `bot_sessions` tables |

---

## Deployment checklist

```bash
# 1. Install dependencies
npm install

# 2. Set all env vars (copy .env.example → .env, fill in every value)
# ⚠️  INTERNAL_API_KEY must match the bot's INTERNAL_API_KEY exactly

# 3. Run migrations (creates all tables including artisans + bot_sessions)
npx prisma migrate deploy

# 4. Build
npm run build

# 5. Start
npm run start:prod
# (this runs `prisma migrate deploy && node dist/server.js` — safe to run on every deploy)
```

On **Render / Railway**: set the start command to `npm run start:prod`. This guarantees migrations always run before the server starts, even on fresh deployments.
