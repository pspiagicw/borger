#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR=/opt/borger
DB_DIR=/var/lib/borger
SERVICE_NAME=borger
SERVICE_FILE=/etc/systemd/system/${SERVICE_NAME}.service

# must run from the project/tarball root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── preflight ─────────────────────────────────────────────────────────────────

if [[ $EUID -ne 0 ]]; then
  echo "error: run this script as root (sudo ./deploy/install.sh)" >&2
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "error: node not found — install nodejs first (dnf install nodejs)" >&2
  exit 1
fi

if ! command -v borgmatic &>/dev/null; then
  echo "warning: borgmatic not found in PATH — make sure it is installed and accessible to root"
fi

NODE_BIN="$(command -v node)"
echo "==> node: $NODE_BIN ($(node --version))"
echo "==> install dir: $INSTALL_DIR"
echo "==> database:    $DB_DIR/borger.db"
echo ""

# ── stop existing service if running ─────────────────────────────────────────

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  echo "==> stopping existing service"
  systemctl stop "$SERVICE_NAME"
fi

# ── copy files ────────────────────────────────────────────────────────────────

echo "==> copying files to $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -r \
  "$SOURCE_DIR/server.js" \
  "$SOURCE_DIR/internal" \
  "$SOURCE_DIR/package.json" \
  "$SOURCE_DIR/package-lock.json" \
  "$SOURCE_DIR/web" \
  "$SOURCE_DIR/deploy" \
  "$INSTALL_DIR/"

# ── node dependencies ─────────────────────────────────────────────────────────

echo "==> installing node dependencies"
npm install --prefix "$INSTALL_DIR" --omit=dev --silent

# ── database directory ────────────────────────────────────────────────────────

echo "==> creating database directory $DB_DIR"
mkdir -p "$DB_DIR"

# ── systemd service ───────────────────────────────────────────────────────────

echo "==> installing systemd service"

# patch ExecStart to use the actual node binary path
sed "s|/usr/bin/node|${NODE_BIN}|g" \
  "$INSTALL_DIR/deploy/borger.service" > "$SERVICE_FILE"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

# ── done ─────────────────────────────────────────────────────────────────────

echo ""
echo "==> done. service status:"
systemctl status "$SERVICE_NAME" --no-pager -l

echo ""
echo "Useful commands:"
echo "  journalctl -u borger -f          # live logs"
echo "  systemctl restart borger         # restart"
echo "  systemctl stop borger            # stop"
