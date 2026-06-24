# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (root)
```bash
npm run dev          # Vite dev server on port 3055
npm run build        # Production build → dist/
npm run type-check   # tsc --noEmit (no output files)
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run
```

### Backend
```bash
cd backend
npm run dev          # nodemon server.js (hot-reload)
npm start            # node server.js (production)
```

### Database migrations
Run migration scripts directly via Node (psql not required):
```bash
cd backend && node run-migration.js   # pattern used ad-hoc
```
Migration SQL files live in `sql/migrations/`. Run them in Node with the `pg` pool from `backend/db.js` using the `backend/.env` credentials.

## Architecture

This is a **monorepo** with two independent runtimes:

### Backend — `backend/`
Express + Node.js (ESM, `"type": "module"`). Single entry: `backend/server.js`.
- **`backend/routes/`** — one file per domain (`products.js`, `orders.js`, `users.js`, `roles.js`, …). Each exports an Express router, mounted under `/api/<name>` in `server.js`.
- **`backend/middleware/auth.js`** — JWT verification via `authMiddleware`. All protected routes use it.
- **`backend/storage/minio.js`** — MinIO client singleton. `uploadToMinio(buffer, folder, mime)` returns `{ url, objectKey }`. The public URL is always built from `process.env.MINIO_PUBLIC_URL + '/' + BUCKET + '/' + objectKey`. Never hardcode the domain.
- **`backend/db.js`** — `pg.Pool` singleton. All routes import it directly.

### Frontend — `front/`
React 19 + Vite 6 + TypeScript. Entry: `front/App.tsx`. Build root is `front/`, output to `dist/`.

**Module layout** (`front/modules/`):
- `core/` — shared foundation: `services/apiClient.ts` (all HTTP calls), `services/dataService.ts` (cached aggregation layer, 30 s TTL), `types/` (all domain interfaces), `hooks/`, `components/ui|layout|filters|forms|modals`.
- `auth/` — login flow, `authService.ts` (JWT + localStorage), `useAppAuth.ts` hook, `ProtectedRoute`.
- `admin/` — user management pages, settings.
- `shop/` — public storefront (`Shop.tsx`, `ProductLandingPage.tsx`, `StoreDashboard.tsx`).
- `products/` — product CRUD + full stock management (movements, adjustments, audits, lots, alerts, forecasts).
- `sales/` — orders (`Orders.tsx`), sales (`Sales.tsx`), delivery service.
- `customers/` — customer list, profile, CRM actions.
- `media/` — image gallery backed by MinIO.

**Routing** (React Router v6):
- Public: `/`, `/loja`, `/produto/:slug`, `/sobre`
- Admin (authenticated): `/admin/*` — all mapped in `front/modules/core/routes/adminRoutes.ts` via `ADMIN_ROUTE_MAP`. Use `getAdminPath(pageId)` to navigate; use `getActivePageFromPath(pathname)` to resolve the active menu item.
- All admin pages are `React.lazy` loaded in `App.tsx`.

**API communication**:
- Every service imports `api` from `front/modules/core/services/apiClient.ts` (`api.get`, `api.post`, `api.put`, `api.delete`).
- Base URL: `import.meta.env.VITE_API_URL` (baked at build time by Vite).
- Auth token stored in `localStorage` as `auth_token`; auto-attached as `Authorization: Bearer …`.
- 401 responses dispatch `auth:logout` custom event and clear the token.

**Permissions**:
- Role check helpers in `front/modules/core/hooks/useUserPermissions.ts`: `isClientUser`, `isStaffUser`, `canManageUsers`, `hasRole`, `hasAnyRole`.
- `User.roles` (array, from JWT) is the source of truth; `User.role` (single string) is the legacy fallback.
- Clients (`CLIENTE`) are restricted from all admin pages.

## Environment Variables

### Frontend (read by Vite at **build time** — changing them requires a rebuild)
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API base URL (`/api`) |
| `VITE_MINIO_PUBLIC_URL` | MinIO public domain for image URLs |
| `VITE_MINIO_BUCKET` | MinIO bucket name |

Active `.env` is the **root** `.env` (not `front/.env`), because `vite.config.ts` sets `envDir: path.resolve(__dirname)`.

### Backend (read at **runtime** by Node)
`PG_HOST/PORT/DATABASE/USER/PASSWORD`, `JWT_SECRET`, `MINIO_ENDPOINT/PORT/USE_SSL/ACCESS_KEY/SECRET_KEY/BUCKET/PUBLIC_URL`, `FRONTEND_URL`, `PORT`.

## Database

PostgreSQL on VPS (`PG_HOST=168.231.104.15`, port 5433). Schema bootstrapped by `sql/SCHEMA_POSTGRESQL_COMPLETO.sql` + `sql/PARTE_1/2/3_*.sql`. Column additions via `sql/migrations/`.

Key tables: `profiles` (users + auth), `roles`, `permissions`, `user_roles`, `role_permissions`, `products`, `orders`, `customers`, `sales`, `stock_movements`, `shop_visits`, `admin_activity_log`.

`profiles` requires columns added by `sql/migrations/ALTER_PROFILES_ADD_COLUMNS.sql` (`password_hash`, `avatar_url`, `location_ids`). Run `sql/migrations/CREATE_PERMISSIONS_SYSTEM.sql` to create the roles/permissions system and seed default roles.

## Key Patterns

- **Image URLs** are stored in the DB as full absolute URLs (`https://minio.leadsflowapi.com/public/…`). When the MinIO domain changes, run a SQL `REPLACE` on `products.image`, `products.image_url2/3/4`, and `profiles.avatar_url`.
- **`dataService`** wraps all domain services with a 30 s in-memory cache. Call `dataService.invalidate(key)` or let TTL expire rather than bypassing it.
- **`uploadService.getPublicUrl(path)`** — if `path` already starts with `http`, it is returned unchanged; otherwise it constructs `MINIO_PUBLIC_URL/BUCKET/path`.
- Adding a new admin route: add an entry to `ADMIN_ROUTE_MAP` in `adminRoutes.ts`, add the `<Route>` in `App.tsx`, lazy-import the page component.
- Adding a backend route: create `backend/routes/<name>.js`, import and mount it in `backend/server.js`.
