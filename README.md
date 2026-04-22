# Borger

Simple Go web app that runs `borgmatic list --json` and renders a dashboard for repositories and archives.

## Development Run

1. Install deps:
   - `go`
   - `node`, `npm`
   - `borgmatic`
2. Install frontend tooling:
   - `npm install`
3. Build CSS:
   - `npm run build:css`
4. Start server:
   - `go run ./cmd/web`
5. Open:
   - `http://localhost:8080`

## Build Binary

1. Build local binary:
   - `make build`
2. Output:
   - `./bin/borger`

## Package for Fedora/Homelab

1. Build distribution tarball:
   - `make package`
2. Output:
   - `./dist/borger-<version>-linux-amd64.tar.gz`
3. Extract on target host:
   - `sudo mkdir -p /opt/borger`
   - `sudo tar -xzf borger-<version>-linux-amd64.tar.gz -C /opt/borger`
4. Create service user:
   - `sudo useradd --system --home /opt/borger --shell /sbin/nologin borger`
5. Install systemd unit:
   - `sudo cp /opt/borger/borger.service /etc/systemd/system/borger.service`
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable --now borger`
6. Check status:
   - `systemctl status borger`

## Environment variables

- `APP_ADDR` (default `:8080`)
- `BORGMATIC_BIN` (default `borgmatic`)
