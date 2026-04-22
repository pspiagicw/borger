# Borger

Simple Go web app that runs `borgmatic list --json` and renders a dashboard for repositories and archives.

## Run

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

## Environment variables

- `APP_ADDR` (default `:8080`)
- `BORGMATIC_BIN` (default `borgmatic`)
