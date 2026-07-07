# comiQR — Supervisor + cron (production process management)

`deploy.sh` assumes Supervisor manages the long-running PHP processes and that a
cron drives the Laravel scheduler. The unit files here fill that gap (B2).

## 1. Supervisor programs

Copy both `.conf` files into `/etc/supervisor/conf.d/`, adjust the `/var/www/comiqr`
path + PHP version if needed, then:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start comiqr-horizon comiqr-reverb
sudo supervisorctl status
```

- **comiqr-horizon** — queue workers (Horizon). `deploy.sh` runs `horizon:terminate`
  so Supervisor restarts it with the new release.
- **comiqr-reverb** — WebSocket server on `127.0.0.1:8080`; nginx proxies the public
  `wss://` endpoint to it. Requires `BROADCAST_CONNECTION=reverb` in `.env`.

## 2. Scheduler cron (drives housekeeping — see routes/console.php)

Add to the `www-data` crontab (`sudo crontab -u www-data -e`):

```cron
* * * * * cd /var/www/comiqr/apps/api && php artisan schedule:run >> /dev/null 2>&1
```

Without this, `sanctum:prune-expired` / `queue:prune-failed` / `model:prune` never run
and those tables grow unbounded.
