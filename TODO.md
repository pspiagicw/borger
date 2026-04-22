# Borgmatic Backup Dashboard TODO (Node.js)

## 1. Runtime
- [x] Replace Go backend with pure Node.js server (`server.js`).
- [x] Keep routes: `GET /` and `GET /healthz`.
- [x] Keep static asset serving for Tailwind CSS.

## 2. Borgmatic Integration
- [x] Use fixed command: `borgmatic -c ~/.config/borgmatic.d list --json`.
- [x] Parse JSON output into repository/archive view models.
- [x] Handle multi-repository output.
- [x] Sort archives descending by timestamp.
- [x] Compute global latest backup.
- [x] Handle command and parse errors in UI.

## 3. UI
- [x] Hero section with latest backup timestamp and relative time.
- [x] Human-friendly date formatting.
- [x] Repository cards and archive list.
- [x] Obfuscate repository URL by default.
- [x] Reveal full URL with Show/Hide button.

## 4. Tooling
- [x] Keep Tailwind build pipeline.
- [x] Add Node-based Make targets (`setup`, `dev`, `run`, `package`).
- [x] Add Node package scripts (`start`, `dev`).

## 5. Deployment
- [x] Update `systemd` unit for Node runtime.
- [x] Add packaging output (`dist/borger-node-<version>.tar.gz`).
- [x] Update Fedora deployment docs.

## 6. Next Improvements
- [ ] Add unit tests for date parsing and aggregation.
- [ ] Add endpoint-level integration tests.
- [ ] Add periodic background refresh instead of per-request command execution.
