#!/bin/sh
# The app on this computer against a local Supabase in Docker, with the demo print shop (owner@printflow.demo /
# Demo1234!). Production data is never touched: the Supabase keys from .env.local are replaced by the local ones;
# AI_BASE_URL, AI_API_KEY and AI_MODEL still come from .env.local.
#   npm run dev:local            # http://localhost:3000
#   npm run dev:local -- --seed  # recreate the demo data first
set -e
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Запустите Docker Desktop и повторите" >&2
  exit 1
fi
npx supabase start >/dev/null
npx supabase migration up --local >/dev/null

eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)=')"
case "$API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Не удалось получить адрес локальной Supabase" >&2; exit 1 ;;
esac
export NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export DATABASE_URL="$DB_URL" NEXT_PUBLIC_SITE_URL="http://localhost:3000"

if [ "$1" = "--seed" ] || [ "$(curl -s "$API_URL/rest/v1/companies?slug=eq.demo&select=id" -H "apikey: $ANON_KEY")" = "[]" ]; then
  npm run seed
fi

grep -q '^AI_API_KEY=.' .env.local 2>/dev/null || echo "ИИ без нейросети: добавьте AI_BASE_URL, AI_API_KEY и AI_MODEL в .env.local"
echo "Панель: http://localhost:3000/admin/login — owner@printflow.demo / Demo1234!"
echo "Клиент: http://localhost:3000/c/demo/login — anna@printflow.demo / Demo1234!"
exec npx next dev
