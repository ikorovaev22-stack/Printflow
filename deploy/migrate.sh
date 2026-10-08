#!/bin/sh
#
# Applies new files from supabase/migrations to the self-hosted database, each in its own transaction.
# Bookkeeping is the same table the Supabase CLI uses (supabase_migrations.schema_migrations).
# Called by install.sh; can also be run on its own: sh deploy/migrate.sh

set -e

cd "$(dirname "$0")/supabase"
MIGRATIONS=../../supabase/migrations

psql() {
  docker compose exec -T db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}

psql -c "create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"

applied=$(psql -tA -c "select version from supabase_migrations.schema_migrations")

for file in "$MIGRATIONS"/*.sql; do
  base=$(basename "$file" .sql)
  version=${base%%_*}
  name=${base#*_}
  if printf '%s\n' "$applied" | grep -qx "$version"; then
    continue
  fi
  echo "→ $base"
  {
    cat "$file"
    echo
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name');"
  } | psql -1 -f -
done

echo "База в актуальном состоянии."
