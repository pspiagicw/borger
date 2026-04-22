# Borger (Node.js)

Node.js web app that runs:
`borgmatic -c ~/.config/borgmatic.d list --json`
and renders a backup dashboard.

## Development Run

1. Install deps:
   - `node`, `npm`
   - `borgmatic`
2. Install packages:
   - `npm install`
3. Build CSS:
   - `npm run build:css`
4. Start server:
   - `npm run dev`
5. Open:
   - `http://localhost:8090`

## Make Targets

1. `make setup` installs packages and builds CSS.
2. `make dev` runs the app (default `APP_ADDR=:8090`).
3. `make run` runs the app for normal execution.
4. `make package` creates a deploy tarball in `dist/`.

## Package for Fedora/Homelab

1. Build package:
   - `make package`
2. Output:
   - `./dist/borger-node-<version>.tar.gz`
3. Extract on target host:
   - `sudo mkdir -p /opt/borger`
   - `sudo tar -xzf borger-node-<version>.tar.gz -C /opt/borger`
4. Install runtime deps on Fedora:
   - `sudo dnf install -y nodejs borgmatic`
5. Create service user:
   - `sudo useradd --system --home /opt/borger --shell /sbin/nologin borger`
6. Install and start systemd service:
   - `sudo cp /opt/borger/deploy/borger.service /etc/systemd/system/borger.service`
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable --now borger`
7. Check status:
   - `systemctl status borger`

## Environment variables

- `APP_ADDR` (default `:8090`)
- `APP_TIMEZONE` (default `Asia/Kolkata`; set `auto` to use server timezone)
- `APP_CACHE_TTL_SECONDS` (default `120`)
