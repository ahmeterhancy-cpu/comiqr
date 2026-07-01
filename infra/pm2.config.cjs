// ComiQR — PM2 process definitions for the 3 Next apps on Hetzner (docs/00 topology).
// Cloudflare fronts all origins; Nginx reverse-proxies to these ports.
module.exports = {
  apps: [
    {
      name: 'comiqr-web-customer',
      cwd: './apps/web-customer',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: { NODE_ENV: 'production', PORT: '3000' },
    },
    {
      name: 'comiqr-web-admin',
      cwd: './apps/web-admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      env: { NODE_ENV: 'production', PORT: '3001' },
    },
    {
      name: 'comiqr-web-kds',
      cwd: './apps/web-kds',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      env: { NODE_ENV: 'production', PORT: '3002' },
    },
  ],
};
