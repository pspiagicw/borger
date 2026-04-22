# Borgmatic Backup Dashboard TODO

## 1. Project Bootstrap
- [ ] Initialize Go module and folder structure (`cmd/web`, `internal/*`, `web/*`).
- [ ] Add HTTP server bootstrap with graceful shutdown and config via env vars.
- [ ] Add base middleware (request ID, logging, panic recovery, timeouts).

## 2. Borgmatic Data Integration
- [ ] Implement a command runner for `borgmatic list --json`.
- [ ] Parse borgmatic JSON output into typed Go structs.
- [ ] Support multiple repositories from a single borgmatic JSON response.
- [ ] Normalize archive fields (name, timestamp, repository location/label).
- [ ] Sort archives by timestamp descending.
- [ ] Compute repository-level latest backup and global latest backup.
- [ ] Compute human-readable relative time (e.g. `2h ago`) for latest backup hero.
- [ ] Add robust error handling for command failures, invalid JSON, and empty results.

## 3. Application Service Layer
- [ ] Create dashboard service that aggregates repositories and archives.
- [ ] Define view models for templates (hero block + grouped archive list).
- [ ] Add polling/refresh strategy (manual refresh endpoint and/or timed refresh).

## 4. Web UI
- [ ] Build base HTML layout and shared partials.
- [ ] Implement hero section showing latest backup date/time and relative time.
- [ ] Implement repository cards/sections with per-repo latest backup summary.
- [ ] Implement archive table/list grouped by repository.
- [ ] Add empty/error states in UI.
- [ ] Add responsive styling for desktop and mobile.

## 5. Styling Pipeline
- [ ] Initialize `package.json` with local dev dependencies only.
- [ ] Configure Tailwind CSS build pipeline in project-local scope.
- [ ] Create intentional visual theme (typography, color variables, spacing scale).
- [ ] Add production CSS build output and development watch command.

## 6. Routing and Endpoints
- [ ] `GET /` dashboard page.
- [ ] `GET /healthz` health check endpoint.
- [ ] Optional: `POST /refresh` endpoint to force re-fetch borgmatic data.

## 7. Tests
- [ ] Unit tests for JSON parsing with realistic borgmatic fixtures.
- [ ] Unit tests for latest-backup selection and relative time formatting.
- [ ] Unit tests for sort/group behavior across multiple repositories.
- [ ] Handler tests for dashboard and error states.

## 8. Tooling and Quality
- [ ] Add `Makefile` targets (`run`, `test`, `build`, `css`, `css-watch`).
- [ ] Add lint/static checks (`go test`, `go vet`).
- [ ] Add sample env file and developer README.

## 9. Delivery
- [ ] Verify app against real `borgmatic list --json` output on this machine.
- [ ] Final UI polish pass.
- [ ] Document run/build instructions.
- [ ] Create incremental commits using the required format:
  - [ ] `[codex] feat: <message>`
  - [ ] `[codex] refactor: <message>`
