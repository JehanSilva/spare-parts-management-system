# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A spare-parts / auto shop management system ("NSS Auto Spares") with a Django REST API backend and a React (CRA) + Tailwind frontend. Covers POS/checkout, inventory & restocking, suppliers, customers & their vehicles, sales history, employee attendance/payroll, and daily/dashboard reporting.

- Backend: Django 6 + Django REST Framework, single app `inventory`, JWT auth (`rest_framework_simplejwt`), Postgres, media via Cloudinary, static via Whitenoise.
- Frontend: Create React App (`react-scripts`) + Tailwind CSS, plain JS (no TypeScript), React Router v7, Axios, Recharts, `react-to-print`.
- Deploy targets: Railway/Render (backend, via `build.sh`) and Vercel (frontend).

## Commands

### Backend (run from repo root, with `.venv` activated)
```bash
source .venv/bin/activate        # venv already exists in repo root
python manage.py runserver
python manage.py makemigrations inventory   # after changing inventory/models.py
python manage.py migrate
python manage.py check                      # quick sanity check, no DB needed
python manage.py test inventory             # run all backend tests
python manage.py test inventory.tests.PartMinimalAPITest            # single test class
python manage.py test inventory.tests.PartMinimalAPITest.test_get_parts_minimal  # single test
python manage.py send_daily_summary         # custom management command; emails sales/stock summary to ADMIN_EMAILS
```
Local Postgres config and secrets (SECRET_KEY, DB_*, CLOUDINARY_*, EMAIL_*, ADMIN_EMAILS) are read from a `.env` file at repo root via `python-dotenv` (see `backend/settings.py`). In production, `DATABASE_URL` (Railway/Render) takes precedence over the individual `DB_*` vars.

### Frontend (run from `frontend/`)
```bash
npm start        # dev server, http://localhost:3000
npm run build     # production build
npm test          # CRA/Jest test runner (watch mode)
npx eslint src/pages/SomePage.js   # lint a single file (eslintConfig lives in package.json: "react-app")
```
`frontend/.env`/CRA env vars: `REACT_APP_API_URL` must point at the Django API root (e.g. `http://localhost:8000/api`) — see `frontend/src/services/api.js`.

## Architecture

### Backend: everything lives in one Django app (`inventory/`)

There is no split into multiple apps — `inventory/models.py`, `serializers.py`, `views.py`, and `urls.py` contain essentially the entire domain. `views.py` is large (~1500 lines) and uses **function-based views with `@api_view`**, not DRF viewsets/routers — every endpoint is manually wired in `inventory/urls.py` (mounted under `/api/` in `backend/urls.py`).

Important pattern: several DRF serializers (e.g. `SaleSerializer`) define a custom `create()` method that is **not actually used** — the corresponding view (`create_sale`) builds objects manually from `request.data` instead of calling `serializer.save()`. When adding fields that need to be persisted on creation (e.g. a new `Sale` field), check both the serializer *and* the view function, since a field can be "in the serializer" without ever reaching the DB if the view bypasses it.

Key models and relationships (`inventory/models.py`):
- `Part` — the catalog item (UUID pk), linked to `Supplier` and to `Vehicle` (make/model/year compatibility catalog) via M2M `compatible_vehicles`.
- `Customer` / `CustomerVehicle` — a real customer and their registered plate numbers. Distinct from `Vehicle` (which is just the make/model/year catalog used for parts compatibility, not an owned vehicle).
- `Sale` (UUID pk) / `SaleItem` — a completed (or cancelled) transaction. `Sale.status` is `COMPLETED`/`CANCELLED` (sale lifecycle); `Sale.payment_status` is a separate `PAID`/`CREDIT` axis for "pay later" sales, with `credit_note` and `credit_settled_at`. Don't conflate the two status fields. `SaleItem.total_price` is auto-calculated in `save()` from `unit_price`, `discount`, `quantity` — never set it directly.
- `ActiveCart` — persists in-progress POS carts (id, customer/vehicle text, JSON `items`) server-side so multiple "repair" tabs survive refresh/reload; synced from the frontend via debounced POST.
- `Employee` / `Attendance` / `Holiday` / `Payroll` — attendance-and-payroll module, largely independent of the sales/inventory side. `Payroll.save()` auto-computes `net_salary`.
- `RestockRecord` — source-of-truth purchase history per supplier per restock event, with return tracking (`ACTIVE`/`PARTIALLY_RETURNED`/`FULLY_RETURNED`).

Two dashboard-stats endpoints exist in `views.py` (`dashboard_stats` and `get_dashboard_stats`); only `get_dashboard_stats` (mounted at `/dashboard/stats/`) is actually called by the frontend — the other is dead code. Revenue/profit aggregates there are computed from `Sale.objects.all()`/`SaleItem.objects.all()` with only a date filter, not a status filter, while the "Top Sold Parts"/"Sales Trend" sections do filter on `status='COMPLETED'` — keep this inconsistency in mind if extending dashboard math.

### Frontend: page-per-route, no state management library

- `frontend/src/App.js` defines all routes and wraps everything in a `Layout` (hides `Navbar` only on `/login`) and a `PartsProvider`.
- `frontend/src/pages/*.js` — one file per route/feature (POS, Inventory, Customers, Suppliers, Vehicles, Sales History, Employees, Daily Report, Home). Pages are large, self-contained files that often define their own modal sub-components inline at the top of the file (e.g. `EditSaleModal`, `CancelSaleModal` inside `SalesHistoryPage.js`) rather than extracting them — follow that convention for page-scoped modals; only pull a component into `components/` when it's shared across pages (see `ConfirmModal`, `AlertComponent`, `Receipt`).
- `frontend/src/services/api.js` — the single Axios instance and every API call as a plain exported function (`fetchX`/`createX`/`updateX`/`deleteX`). All requests go through one interceptor that attaches the JWT (`localStorage.access_token`) and force-logs-out on 401. Add new endpoints here rather than calling Axios directly from a page.
- `frontend/src/context/PartsContext.js` — a global in-memory cache of *all* parts, fetched once and filtered client-side by both `InventoryPage` and `POSPage` (no per-keystroke API calls). It auto-refreshes every 5 minutes and on tab focus if stale, and must be explicitly invalidated (`invalidateParts()`) after any mutation that changes stock/parts data.
- `frontend/src/hooks/useAutoLogout.js` — inactivity (1 hour) + JWT-expiry auto-logout, wired once in `App.js`.
- POS (`POSPage.js`) is the most complex page: multiple concurrent "repair" carts persisted to `ActiveCart` server-side (debounced 500ms sync), vehicle-number-triggered customer lookup/linking (existing customer search or new-customer registration inline), per-line discounts (amount or percent, kept in sync), and credit/pay-later checkout.
- Styling is Tailwind utility classes throughout; no CSS modules/styled-components. Icons are `lucide-react`. There's no design-system/component library beyond the small shared `components/` set.
