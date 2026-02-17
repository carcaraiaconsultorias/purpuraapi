# Deploy Checklist - OS Purpura (A-F)

## 1) Required Environment Variables

Backend:

- `NODE_ENV`
- `API_PORT`
- `API_PUBLIC_URL`
- `DATABASE_URL_PG`
- `DATABASE_SSL`
- `CORS_ORIGINS`
- `ADMIN_USER`
- `ADMIN_PASS`
- `SESSION_TTL_MS`
- `OUTBOUND_HTTP_TIMEOUT_MS`
- `ALLOW_DEV_NO_AUTH`
- `WHATSAPP_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_GRAPH_API_BASE_URL`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_SENDER_ENABLED`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_DRIVE_SHARE_WITH_EMAIL`
- `GOOGLE_DRIVE_SHARE_ROLE`
- `GOOGLE_DRIVE_ALLOW_PUBLIC`
- `TRELLO_API_BASE_URL`
- `TRELLO_API_KEY`
- `TRELLO_TOKEN`
- `TRELLO_DEFAULT_LIST_ID` or one of `TRELLO_TASK_LIST_ID`, `TRELLO_BRIEFING_LIST_ID`, `TRELLO_FOLLOW_UP_LIST_ID`
- `LOVABLE_API_KEY`

Frontend:

- `VITE_API_BASE_URL`

Do not set secrets in `VITE_*`.

## 2) CORS Configuration

`CORS_ORIGINS` must contain only allowed production origins, comma separated.

Example:

```env
CORS_ORIGINS=https://cliente.lovable.app,https://painel.cliente.com
```

Localhost origins are always allowed for development:

- `http://localhost:5173`
- `http://localhost:3000`

## 3) Database Setup

Apply in order:

1. `backend/db/schema.sql`
2. `backend/db/20260214193000_whatsapp_onboarding_block_a.sql`
3. `backend/db/20260215190000_operational_trello_block_c.sql`
4. `backend/db/20260216183000_reminders_block_e.sql`

Optional local seed:

- `backend/db/seed.sql`

## 4) RLS Validation Query

```sql
select
  c.relname,
  c.relrowsecurity,
  c.relforcerowsecurity
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
order by c.relname;
```

Expected: `relrowsecurity = true` and `relforcerowsecurity = true` on all runtime tables.

## 5) Run Backend and Frontend

Backend:

```bash
node --env-file=.env backend/server.mjs
```

Frontend:

```bash
npm run dev
```

## 6) Auth and Production Gate

- In production (`NODE_ENV=production`), authenticated session is required.
- Login endpoint: `POST /auth/login`
- Protected endpoints: `/db/query`, `/functions/*`, `/run-reminders`, operational routes.
- For local debugging only, set `ALLOW_DEV_NO_AUTH=1`.

## 7) Bloco F Smoke (End-to-End)

1. Login:
   - `POST /auth/login` with `username`, `password`
2. WhatsApp inbound simulation:
   - `POST /whatsapp-webhook` with valid signature
3. Check DB evidence:
   - `clientes`, `onboarding_sessions`, `onboarding_messages`, `onboarding_status_history`
4. Dashboard endpoints:
   - `POST /functions/onboarding-dashboard`
   - `POST /functions/operational-list`
5. Transition:
   - `POST /functions/onboarding-transition`
6. Reminders dry run:
   - `POST /functions/run-reminders` with `{"mode":"today","dry_run":true}`

## 8) Trello Smoke (When Credentials Arrive)

```bash
node --env-file=.env scripts/trello-smoke.mjs
```

Optional:

- invalid token check:
  - `TRELLO_TOKEN_INVALID_TEST=1 node --env-file=.env scripts/trello-smoke.mjs`
- cleanup archive:
  - `TRELLO_SMOKE_CLEANUP=1 node --env-file=.env scripts/trello-smoke.mjs`

## 9) Reminders Validation

Dry run:

```json
POST /functions/run-reminders
{
  "mode": "today",
  "dry_run": true
}
```

Real send requires:

- `WHATSAPP_SENDER_ENABLED=true`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`

## 10) Frontend Secret Hygiene

Before release:

- No service tokens in `VITE_*`
- No hardcoded credentials in frontend source
- Browser network must not send backend secrets
- `.env` and `.env.*` remain ignored by git
