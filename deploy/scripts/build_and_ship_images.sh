#!/usr/bin/env bash
set -euo pipefail

# Build locally, upload image archive, and start remotely without remote build.
# Usage:
#   bash scripts/build_and_ship_images.sh [-i ssh_key] [remote_user] [remote_host] [remote_path]
# Example:
#   bash scripts/build_and_ship_images.sh -i ~/.ssh/id_rsa admin 8.145.62.94 /www/wwwroot/vue3.0-koa2

SSH_KEY_PATH=""
if [ "${1:-}" = "-i" ]; then
  SSH_KEY_PATH="${2:-}"
  shift 2
fi

REMOTE_USER="${1:-admin}"
REMOTE_HOST="${2:-8.145.62.94}"
REMOTE_PATH="${3:-/www/wwwroot/vue3.0-koa2}"
SSH_PORT="${SSH_PORT:-22}"
PROJECT_NAME="my_project"
PLATFORM="linux/amd64"
ARCHIVE_NAME="my_project_images_$(date +%Y%m%d_%H%M%S).tar.gz"

DEFAULT_DEEPSEEK_API_KEY="sk-26ca00a3f31d4c2283842b103bc33f97"
DEFAULT_DASHSCOPE_API_KEY="sk-33990e54c1704d13a1ab20a0e2073019"
DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-$DEFAULT_DEEPSEEK_API_KEY}"
DASHSCOPE_API_KEY="${DASHSCOPE_API_KEY:-$DEFAULT_DASHSCOPE_API_KEY}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found on local machine."
  exit 1
fi

if ! command -v scp >/dev/null 2>&1 || ! command -v ssh >/dev/null 2>&1; then
  echo "ssh/scp not found on local machine."
  exit 1
fi

# Fallback for local Docker Desktop permission issues on ~/.docker/buildx
if [ -d "${HOME}/.docker/buildx/activity" ] && [ ! -w "${HOME}/.docker/buildx/activity" ]; then
  export DOCKER_CONFIG="/tmp/docker-config"
  mkdir -p "${DOCKER_CONFIG}"
  echo "Detected unwritable ~/.docker/buildx/activity, using DOCKER_CONFIG=${DOCKER_CONFIG}"
fi

SSH_OPTS="-p ${SSH_PORT}"
SCP_OPTS="-P ${SSH_PORT}"
if [ -n "${SSH_KEY_PATH}" ]; then
  SSH_OPTS="${SSH_OPTS} -i ${SSH_KEY_PATH}"
  SCP_OPTS="${SCP_OPTS} -i ${SSH_KEY_PATH}"
fi

echo "==> Build local images (${PLATFORM})"
docker buildx build --platform "${PLATFORM}" -t my_project/web:latest ./vue3-koa2-web --load
docker buildx build --platform "${PLATFORM}" -t my_project/webserver:latest ./vue3-koa2-server --load
docker pull mongo:latest

echo "==> Save images to ${ARCHIVE_NAME}"
docker save my_project/web:latest my_project/webserver:latest mongo:latest | gzip > "${ARCHIVE_NAME}"

echo "==> Ensure remote path"
ssh ${SSH_OPTS} "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${REMOTE_PATH}'"

echo "==> Upload archive + deploy compose"
if command -v pv >/dev/null 2>&1; then
  FILE_SIZE_BYTES="$(wc -c < "${ARCHIVE_NAME}" | tr -d ' ')"
  pv -s "${FILE_SIZE_BYTES}" "${ARCHIVE_NAME}" | \
    ssh ${SSH_OPTS} "${REMOTE_USER}@${REMOTE_HOST}" "cat > '${REMOTE_PATH}/${ARCHIVE_NAME}'"
else
  scp ${SCP_OPTS} "${ARCHIVE_NAME}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"
fi
scp ${SCP_OPTS} "docker-compose.deploy.yml" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "==> Remote load images and start services"
ssh ${SSH_OPTS} "${REMOTE_USER}@${REMOTE_HOST}" "bash -s" <<EOF_REMOTE
set -euo pipefail
cd "${REMOTE_PATH}"

if command -v docker >/dev/null 2>&1; then
  RUNTIME="docker"
elif command -v podman >/dev/null 2>&1; then
  RUNTIME="podman"
else
  echo "No docker/podman runtime found on remote host."
  exit 1
fi

cat > .env <<ENV_EOF
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}
ENV_EOF

gunzip -c "${ARCHIVE_NAME}" | \
  if [ "\${RUNTIME}" = "docker" ]; then docker load; else podman load; fi

if [ "\${RUNTIME}" = "docker" ]; then
  if docker compose version >/dev/null 2>&1; then
    docker compose -f docker-compose.deploy.yml --project-name "${PROJECT_NAME}" up -d
    docker compose -f docker-compose.deploy.yml --project-name "${PROJECT_NAME}" ps
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f docker-compose.deploy.yml -p "${PROJECT_NAME}" up -d
    docker-compose -f docker-compose.deploy.yml -p "${PROJECT_NAME}" ps
  else
    echo "No docker compose tool available on remote host."
    exit 1
  fi
else
  if podman compose version >/dev/null 2>&1; then
    podman compose -f docker-compose.deploy.yml -p "${PROJECT_NAME}" up -d
    podman compose -f docker-compose.deploy.yml -p "${PROJECT_NAME}" ps
  elif command -v podman-compose >/dev/null 2>&1; then
    podman-compose -f docker-compose.deploy.yml -p "${PROJECT_NAME}" up -d
    podman-compose -f docker-compose.deploy.yml -p "${PROJECT_NAME}" ps
  else
    echo "No podman compose tool available on remote host."
    exit 1
  fi
fi
EOF_REMOTE

echo "==> Done"
echo "Open: http://${REMOTE_HOST}:8080/#/login"
