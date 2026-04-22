# Borgmatic Backup Dashboard TODO

## 1. Project Bootstrap
- [x] Initialize Go module and folder structure (`cmd/web`, `internal/*`, `web/*`).
- [x] Add HTTP server bootstrap with graceful shutdown and config via env vars.
- [x] Add base middleware (request ID, logging, panic recovery, timeouts).

## 2. Borgmatic Data Integration
- [x] Implement a command runner for `borgmatic list --json`.
- [x] Parse borgmatic JSON output into typed Go structs.
- [x] Support multiple repositories from a single borgmatic JSON response.
- [x] Normalize archive fields (name, timestamp, repository location/label).
- [x] Sort archives by timestamp descending.
- [x] Compute repository-level latest backup and global latest backup.
- [x] Compute human-readable relative time (e.g. `2h ago`) for latest backup hero.
- [x] Add robust error handling for command failures, invalid JSON, and empty results.

## 3. Application Service Layer
- [x] Create dashboard service that aggregates repositories and archives.
- [x] Define view models for templates (hero block + grouped archive list).
- [ ] Add polling/refresh strategy (manual refresh endpoint and/or timed refresh).

## 4. Web UI
- [x] Build base HTML layout and shared partials.
- [x] Implement hero section showing latest backup date/time and relative time.
- [x] Implement repository cards/sections with per-repo latest backup summary.
- [x] Implement archive table/list grouped by repository.
- [x] Add empty/error states in UI.
- [x] Add responsive styling for desktop and mobile.
- [x] Format dates in user-friendly strings.
- [x] Obfuscate repository URLs by default and reveal on button click.

## 5. Styling Pipeline
- [x] Initialize `package.json` with local dev dependencies only.
- [x] Configure Tailwind CSS build pipeline in project-local scope.
- [x] Create intentional visual theme (typography, color variables, spacing scale).
- [x] Add production CSS build output and development watch command.

## 6. Routing and Endpoints
- [x] `GET /` dashboard page.
- [x] `GET /healthz` health check endpoint.
- [ ] Optional: `POST /refresh` endpoint to force re-fetch borgmatic data.

## 7. Tests
- [ ] Unit tests for JSON parsing with realistic borgmatic fixtures.
- [ ] Unit tests for latest-backup selection and relative time formatting.
- [ ] Unit tests for sort/group behavior across multiple repositories.
- [ ] Handler tests for dashboard and error states.

## 8. Tooling and Quality
- [x] Add `Makefile` targets (`run`, `test`, `build`, `css`, `css-watch`).
- [x] Add lint/static checks (`go test`, `go vet`).
- [x] Add sample env file and developer README.

## 9. Delivery
- [x] Verify app against real `borgmatic list --json` output on this machine.
- [x] Final UI polish pass.
- [x] Document run/build instructions.
- [x] Create incremental commits using the required format.
