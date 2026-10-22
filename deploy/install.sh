#!/bin/sh
#
# The app + self-hosted Supabase on one server (Ubuntu 24.04, run as root): app, database, auth, files and
# realtime chat all live on this machine. Safe to re-run: after editing deploy/.env or `git pull` it applies
# the settings, rebuilds the app and runs new database migrations.
#
#   cp deploy/.env.example deploy/.env && nano deploy/.env
#   sh deploy/install.sh
#
# First run: installs Docker, downloads the official Supabase self-hosting files (pinned release below) into
# deploy/supabase, generates all secrets there and sets up nightly backups.

set -e

# Official Supabase self-hosting release: https://github.com/supabase/supabase/tree/master/docker
SUPABASE_REF="self-hosted/v0.8.2"

cd "$(dirname "$0")"
DEPLOY_DIR=$(pwd)
ENV_FILE="$DEPLOY_DIR/supabase/.env"

log() { printf "\n===> %s\n" "$*"; }
die() { printf "ОШИБКА: %s\n" "$*" >&2; exit 1; }

[ -f .env ] || die "нет deploy/.env — скопируйте deploy/.env.example в deploy/.env и заполните"

# Reads KEY from deploy/.env without sourcing it (values may contain spaces and quotes)
conf() {
  sed -n "s/^$1=//p" .env | tail -n1 | sed -e 's/\r$//' -e "s/^\"\(.*\)\"$/\1/" -e "s/^'\(.*\)'$/\1/"
}

DOMAIN=$(conf DOMAIN)
APP_NAME=$(conf APP_NAME)
SMTP_HOST=$(conf SMTP_HOST)
SMTP_FROM_EMAIL=$(conf SMTP_FROM_EMAIL)
CONFIRM_EMAIL=$(conf CONFIRM_EMAIL)

case "$DOMAIN" in
  ""|app.example.ru) die "укажите свой DOMAIN в deploy/.env" ;;
  http*|*/*) die "DOMAIN — только имя, без https:// и слэшей (например, zakaz.example.ru)" ;;
esac

# ── 1. Supabase files and secrets (first run only) ──────────────────────
if [ ! -f "$ENV_FILE" ]; then
  log "Устанавливаю Supabase ($SUPABASE_REF) в deploy/supabase"
  skip_deps=""
  [ "$(uname -s)" = "Linux" ] || skip_deps="--skip-deps"
  curl -fsSL "https://raw.githubusercontent.com/supabase/supabase/refs/tags/$SUPABASE_REF/docker/setup.sh" -o /tmp/supabase-setup.sh
  # shellcheck disable=SC2086
  sh /tmp/supabase-setup.sh --project-dir supabase --ref "$SUPABASE_REF" -y $skip_deps
  rm -f /tmp/supabase-setup.sh
fi
[ -f "$ENV_FILE" ] || die "не удалось подготовить deploy/supabase"

# Writes KEY=VALUE into deploy/supabase/.env, replacing an existing line. Values with characters that
# docker compose would interpret ($, spaces, #) are single-quoted, which compose reads literally.
set_env() {
  case "$2" in
    *"'"*) die "$1: значение не должно содержать одинарную кавычку" ;;
    *[!A-Za-z0-9_.:/@*,+=-]*) value="'$2'" ;;
    *) value="$2" ;;
  esac
  K="$1" V="$value" awk '
    BEGIN { k = ENVIRON["K"]; v = ENVIRON["V"] }
    index($0, k "=") == 1 { if (!done) print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "$ENV_FILE" > "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
}

get_env() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1 | sed -e "s/^'\(.*\)'$/\1/"
}

# ── 2. Settings ─────────────────────────────────────────────────────────
log "Применяю настройки из deploy/.env"
set_env COMPOSE_FILE "docker-compose.yml:../docker-compose.printflow.yml"

set_env SUPABASE_PUBLIC_URL "https://sb.$DOMAIN"
set_env API_EXTERNAL_URL "https://sb.$DOMAIN/auth/v1"
set_env SITE_URL "https://$DOMAIN"
set_env ADDITIONAL_REDIRECT_URLS "https://$DOMAIN/**"

set_env PRINTFLOW_DOMAIN "$DOMAIN"
set_env PRINTFLOW_APP_NAME "${APP_NAME:-Арт Проджект}"
set_env PRINTFLOW_DEFAULT_COMPANY_SLUG "$(conf DEFAULT_COMPANY_SLUG)"
set_env STUDIO_DEFAULT_ORGANIZATION "${APP_NAME:-Арт Проджект}"
set_env STUDIO_DEFAULT_PROJECT "${APP_NAME:-Арт Проджект}"
set_env OPENAI_API_KEY ""

# Clients sign up with email and password only
set_env DISABLE_SIGNUP false
set_env ENABLE_EMAIL_SIGNUP true
set_env ENABLE_ANONYMOUS_USERS false
set_env ENABLE_PHONE_SIGNUP false
set_env ENABLE_PHONE_AUTOCONFIRM false

# One mailbox for Supabase Auth (confirmation, password recovery) and the app's client notifications
set_env SMTP_HOST "$SMTP_HOST"
SMTP_PORT=$(conf SMTP_PORT)
set_env SMTP_PORT "${SMTP_PORT:-465}"
set_env SMTP_USER "$(conf SMTP_USER)"
set_env SMTP_PASS "$(conf SMTP_PASS)"
set_env SMTP_ADMIN_EMAIL "${SMTP_FROM_EMAIL:-noreply@$DOMAIN}"
set_env SMTP_SENDER_NAME "$(conf SMTP_FROM_NAME)"
if [ -n "$SMTP_HOST" ] && [ "$CONFIRM_EMAIL" = "true" ]; then
  set_env ENABLE_EMAIL_AUTOCONFIRM false
else
  set_env ENABLE_EMAIL_AUTOCONFIRM true
  [ -n "$SMTP_HOST" ] || echo "Внимание: SMTP не задан — письма не отправляются, восстановить пароль клиенты не смогут."
fi

# Push notifications: VAPID keys are generated once and kept, so subscriptions survive re-runs
if [ -z "$(get_env VAPID_PUBLIC_KEY)" ]; then
  log "Создаю ключи push-уведомлений"
  keys=$(docker run --rm node:22-alpine node -e '
    const { privateKey } = require("crypto").generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const j = privateKey.export({ format: "jwk" });
    const pub = Buffer.concat([Buffer.from([4]), Buffer.from(j.x, "base64url"), Buffer.from(j.y, "base64url")]);
    console.log(pub.toString("base64url"), j.d);
  ')
  set_env VAPID_PUBLIC_KEY "${keys% *}"
  set_env VAPID_PRIVATE_KEY "${keys#* }"
fi

chmod 600 "$ENV_FILE" .env

# ── 3. Start ────────────────────────────────────────────────────────────
# The previous layout (app + proxy to supabase.co, compose project "deploy") holds ports 80/443
if [ -n "$(docker ps -q --filter label=com.docker.compose.project=deploy)" ]; then
  log "Останавливаю прежнюю версию (прокси на supabase.co)"
  docker compose -p deploy down
fi

log "Собираю приложение и запускаю (первый раз — 5–10 минут)"
(cd supabase && sh run.sh start --build --remove-orphans)

log "Применяю миграции базы"
sh ./migrate.sh

# ── 4. Nightly backups ──────────────────────────────────────────────────
if [ "$(uname -s)" = "Linux" ] && [ -d /etc/cron.d ] && [ "$(id -u)" = "0" ]; then
  cat > /etc/cron.d/printflow-backup <<EOF
# The app: database and files backup every night, see deploy/backup.sh
30 3 * * * root sh $DEPLOY_DIR/backup.sh >> /var/log/printflow-backup.log 2>&1
EOF
fi

cat <<EOF

Готово.
  Приложение:   https://$DOMAIN
  Панель:       https://$DOMAIN/admin
  Supabase API: https://sb.$DOMAIN

Типография и владелец (один раз):
  cd $DEPLOY_DIR/supabase && docker compose run --rm tools scripts/create-company.ts \\
    --name "Типография" --slug shop --email owner@example.ru --password 'Надёжный-пароль'

Бэкапы: каждую ночь в $DEPLOY_DIR/backups (14 дней). Studio: см. README → «Свой сервер в России».
EOF
