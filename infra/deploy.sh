#!/usr/bin/env bash
# ComiQR — Hetzner deploy script (docs/04 §4.8, docs/00 Karar 3).
# Invoked by GitHub Actions after tests pass, or manually on the VPS.
#   Backend (Laravel API + Reverb + Horizon via Supervisor/PHP-FPM)
#   + 3 Next apps (PM2/Node) behind Nginx + Cloudflare.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/comiqr}"
BRANCH="${DEPLOY_BRANCH:-main}"

log() { printf '\n\033[1;36m[deploy]\033[0m %s\n' "$1"; }

cd "$REPO_DIR"

log "Pulling $BRANCH"
git fetch --all --quiet
git reset --hard "origin/$BRANCH"

# ---------------------------------------------------------------------------
# Backend — Laravel API (apps/api)
# ---------------------------------------------------------------------------
log "Backend: composer install"
cd "$REPO_DIR/apps/api"
composer install --no-dev --optimize-autoloader --no-interaction

log "Backend: migrate + cache"
php artisan down --render="errors::503" || true
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan up

log "Backend: restart queue (Horizon) + Reverb"
# Supervisor manages horizon + reverb; signal a graceful restart.
php artisan horizon:terminate || true
sudo supervisorctl restart comiqr-reverb || true
sudo systemctl reload php8.3-fpm || true

# ---------------------------------------------------------------------------
# Frontends — Next apps (PM2)
# ---------------------------------------------------------------------------
log "Frontend: pnpm install + build"
cd "$REPO_DIR"
corepack pnpm install --frozen-lockfile
corepack pnpm build --filter=web-customer --filter=web-admin --filter=web-kds

log "Frontend: restart PM2"
pm2 reload infra/pm2.config.cjs --update-env

log "Done."
