# Supabase Legacy Notice

The `supabase/` directory is legacy material from earlier phases.

- It is **not** part of the active production runtime.
- Current runtime uses `backend/server.mjs` + PostgreSQL via `DATABASE_URL_PG`.
- Do not execute `supabase/migrations` or deploy `supabase/functions` in the production pipeline for this OS scope.

Production deploy must use only:

- `backend/db/schema.sql`
- `backend/db/20260214193000_whatsapp_onboarding_block_a.sql`
- `backend/db/20260215190000_operational_trello_block_c.sql`
- `backend/db/20260216183000_reminders_block_e.sql`
- `backend/server.mjs`
