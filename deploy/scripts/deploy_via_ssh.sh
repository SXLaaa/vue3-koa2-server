#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash scripts/deploy_via_ssh.sh [-i ssh_key_path] [remote_user] [remote_host] [remote_path]
#
# Example:
#   bash scripts/deploy_via_ssh.sh root 8.145.62.94 /www/wwwroot/vue3.0-koa2
#   bash scripts/deploy_via_ssh.sh -i ~/.ssh/id_ed25519 admin 8.145.62.94 /www/wwwroot/vue3.0-koa2
#
# Optional env vars:
#   SSH_PORT=22
#   DEEPSEEK_API_KEY=xxx
#   DASHSCOPE_API_KEY=xxx

SSH_KEY_PATH=""
if [ "${1:-}" = "-i" ]; then
  SSH_KEY_PATH="${2:-}"
  shift 2
fi

REMOTE_USER="${1:-root}"
REMOTE_HOST="${2:-8.145.62.94}"
REMOTE_PATH="${3:-/www/wwwroot/vue3.0-koa2}"
SSH_PORT="${SSH_PORT:-22}"
PROJECT_NAME="my_project"
DEFAULT_DEEPSEEK_API_KEY="sk-26ca00a3f31d4c2283842b103bc33f97"
DEFAULT_DASHSCOPE_API_KEY="sk-33990e54c1704d13a1ab20a0e2073019"

DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-$DEFAULT_DEEPSEEK_API_KEY}"
DASHSCOPE_API_KEY="${DASHSCOPE_API_KEY:-$DEFAULT_DASHSCOPE_API_KEY}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync not found. Please install rsync first."
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh not found. Please install openssh client first."
  exit 1
fi

SSH_OPTS="-p ${SSH_PORT}"
if [ -n "${SSH_KEY_PATH}" ]; then
  SSH_OPTS="${SSH_OPTS} -i ${SSH_KEY_PATH}"
fi

echo "==> Sync local code to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
rsync -az --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "logs" \
  --exclude ".DS_Store" \
  -e "ssh ${SSH_OPTS}" \
  ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "==> Run remote deploy commands"
ssh ${SSH_OPTS} "${REMOTE_USER}@${REMOTE_HOST}" "bash -s" <<EOF
set -euo pipefail
cd "${REMOTE_PATH}"

if ! command -v docker >/dev/null 2>&1; then
  if [ -f /etc/os-release ] && grep -qi 'alinux' /etc/os-release; then
    sudo dnf install -y docker
  else
    curl -fsSL https://get.docker.com | sh
  fi
fi

if systemctl list-unit-files | grep -q '^docker\.service'; then
  sudo systemctl enable docker
  sudo systemctl start docker
elif [ -f /etc/os-release ] && grep -qi 'alinux' /etc/os-release; then
  sudo dnf install -y podman podman-docker podman-compose || true
fi

cat > .env <<ENV_EOF
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}
ENV_EOF

if ! docker compose version >/dev/null 2>&1; then
  if [ -f /etc/os-release ] && grep -qi 'alinux' /etc/os-release; then
    sudo dnf install -y docker-compose-plugin || sudo dnf install -y docker-compose || true
  fi
fi

if docker compose version >/dev/null 2>&1; then
  docker compose --project-name "${PROJECT_NAME}" up -d --build
  docker compose --project-name "${PROJECT_NAME}" ps
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose -p "${PROJECT_NAME}" up -d --build
  docker-compose -p "${PROJECT_NAME}" ps
elif podman compose version >/dev/null 2>&1; then
  podman compose -p "${PROJECT_NAME}" up -d --build
  podman compose -p "${PROJECT_NAME}" ps
elif command -v podman-compose >/dev/null 2>&1; then
  podman-compose -p "${PROJECT_NAME}" up -d --build
  podman-compose -p "${PROJECT_NAME}" ps
else
  echo "No compose runtime available: docker compose / docker-compose / podman compose / podman-compose."
  exit 1
fi
EOF

echo "==> Deploy complete"
echo "Open: http://${REMOTE_HOST}:8080/#/login"
