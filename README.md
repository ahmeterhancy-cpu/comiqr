# ComiQR

> **ComiQR** is a working codename. The final brand name is not fixed — never hardcode it;
> read it from `APP_NAME` (backend) / `NEXT_PUBLIC_APP_NAME` (frontend) and i18n.

Multi-tenant advanced **QR menu + ordering + operations SaaS** for restaurants, cafés,
bars, hotels and tourism venues — with a differentiating **Recipe & Nutrition engine**
(auto calories/macros/allergens) and, on top, a consumer discovery portal (marketplace, M20).

Target market priority: **TRNC (KKTC) → Türkiye → tourism verticals**.

Full product & technical specification lives in [`docs/`](./docs) and the working rules in
[`CLAUDE.md`](./CLAUDE.md). Start reading at `docs/01` → `docs/02` → `docs/07`.

## Stack (locked — see `docs/00-altyapi-kararlari.md`)

Next.js 16 · Laravel 13 (PHP 8.3) + Sanctum + Laravel AI SDK · PostgreSQL 16+ (Neon, pgvector) ·
Redis (Upstash) + Horizon · Laravel Reverb · Cloudflare R2 · Tiko/PayTR · React Native/Expo ·
Turborepo + pnpm · Hetzner VPS + Cloudflare.

## Monorepo layout

```
comiqr/
├── CLAUDE.md                 # Claude Code working instructions
├── docs/                     # numbered specs (00–08)
├── apps/
│   ├── api/                  # Laravel 13 backend (REST + Sanctum + Reverb)
│   ├── web-customer/         # Next.js customer PWA (QR menu)
│   ├── web-portal/           # Next.js consumer discovery portal (marketplace, M20)
│   ├── web-admin/            # Next.js management panel
│   ├── web-kds/              # Next.js kitchen display (tablet)
│   └── mobile-waiter/        # React Native + Expo waiter app
├── packages/
│   ├── shared-types/         # shared TS types (API contract)
│   └── ui/                   # shared React components
└── infra/                    # nginx, deploy.sh, docker-compose (dev)
```

## Getting started (dev)

Prerequisites: **Node 22+**, **pnpm 9+**, **PHP 8.3+**, **Composer 2+**, **Docker** (for local Postgres+Redis).

```bash
# 1. Install JS deps
pnpm install

# 2. Start local infra (Postgres 16 + pgvector, Redis)
pnpm infra:up

# 3. Backend (Laravel API)
cd apps/api
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve            # http://localhost:8000

# 4. Frontends (from repo root, all apps)
pnpm dev
```

## Build order

Follow `docs/07-yol-haritasi.md`. **Faz 0** (foundation) → **Faz 1** MVP (menu, recipe/nutrition,
QR/tables, ordering, payment, KDS, waiter, PWA) → Faz 2 → Faz 3.

## Conventions

- **Turkish** in conversation/docs; **English** for all code identifiers (vars, tables, endpoints, commits).
- Every tenant table has `tenant_id`, auto-filtered by an Eloquent global scope. No query touches
  tenant data without `tenant_id`.
- Money/nutrition/stock calculations require unit tests before merge.
