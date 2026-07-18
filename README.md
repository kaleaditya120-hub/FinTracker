# Tab. — Backend Setup

This connects your existing frontend (`public/index.html`, `public/styles.css`, `public/app.js`)
to a real Express + PostgreSQL API. Nothing about the visual design changed —
only IDs were added to elements so `app.js` has hooks to fill in.

## 1. Prerequisites

- Node.js (v18+)
- PostgreSQL running locally (or a hosted instance — Railway, Neon, Supabase all work)

## 2. Install dependencies

```bash
cd backend
npm install
```

## 3. Create the database

```bash
# Create the database itself
createdb tab_finance

# Create tables
psql -d tab_finance -f db/schema.sql

# Load starter data (matches what was originally hardcoded)
psql -d tab_finance -f db/seed.sql
```

## 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set `PGUSER` / `PGPASSWORD` to your local Postgres credentials.

## 5. Run it

```bash
npm run dev     # with auto-restart (nodemon)
# or
npm start        # plain node
```

Then open **http://localhost:3000** — Express serves the frontend directly from `public/`,
so there's no separate frontend server or CORS issue to deal with.

## How the pieces fit together

```
public/index.html   → loads app.js
public/app.js        → fetch('/api/dashboard') on page load
                       → fills in budget numbers, category rings, transaction table
                       → intercepts both forms and POST/PUT's them to the API

server.js             → GET  /api/dashboard      (everything, one call)
                        GET  /api/summary        (just the top numbers)
                        GET  /api/categories     (just the ring data)
                        GET  /api/transactions   (just the table rows)
                        POST /api/expenses       (Add Expense form)
                        PUT  /api/budgets/:slug  (Quick Budget Update form,
                                                   :slug = 'overall' or a category slug)

db.js                 → shared pg connection pool, reads from .env
db/schema.sql          → table definitions (budget, categories, transactions)
db/seed.sql            → starter rows matching the original hardcoded demo data
```

Nothing is stored redundantly — "spent," "remaining," and "% of budget" are all
computed on the fly in `server.js` from the raw `transactions` rows, so they can
never drift out of sync with reality the way hardcoded HTML could.

## Known simplification

There's no authentication yet (`budget` is a single global row, not per-user).
The "$140 more than last week" trend line was removed rather than faked — building
it for real needs a week-over-week query, which is a good next feature once the
core CRUD loop is working end-to-end.

## Suggested next steps, in order

1. Get this running locally and confirm the dashboard matches the old hardcoded numbers exactly.
2. Add an expense through the form, confirm the rings/table/summary update without a page reload.
3. Add a `DELETE /api/expenses/:id` endpoint + a delete button on each row.
4. Add simple auth (even just a login with sessions) once you're ready to support more than one user.
5. Deploy: Railway or Render both host Node + Postgres together with minimal config.
