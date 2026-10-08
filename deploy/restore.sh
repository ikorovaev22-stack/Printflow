#!/bin/sh
#
# Restores a backup made by deploy/backup.sh. Replaces ALL current data: clients, orders, chat, accounts, files.
# Works on a running installation, including a brand-new server after `sh deploy/install.sh`.
#
#   sh deploy/restore.sh deploy/backups/2026-10-08_0330_db.dump deploy/backups/2026-10-08_0330_files.tar.gz

set -e

[ $# -eq 2 ] || { echo "Использование: sh deploy/restore.sh <..._db.dump> <..._files.tar.gz>" >&2; exit 1; }
DUMP=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
FILES=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
[ -f "$DUMP" ] && [ -f "$FILES" ] || { echo "Файлы бэкапа не найдены" >&2; exit 1; }

printf "Все текущие данные будут заменены данными из бэкапа. Продолжить? [y/N] "
read -r answer
[ "$answer" = "y" ] || [ "$answer" = "Y" ] || exit 1

cd "$(dirname "$0")"
sh ./migrate.sh
cd supabase

psql() {
  docker compose exec -T db psql -X -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres "$@"
}

docker compose stop app storage imgproxy

# Empty the same tables backup.sh dumps, then load the rows with triggers off (no duplicate profiles, no FK order issues)
psql -c "do \$\$ declare t text; begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ') into t from pg_tables
  where schemaname in ('public', 'auth', 'storage')
    and format('%I.%I', schemaname, tablename) not in ('auth.schema_migrations', 'storage.migrations');
  execute 'truncate ' || t || ' cascade';
end \$\$;"
docker compose exec -T db pg_restore -U supabase_admin -d postgres --data-only --disable-triggers --exit-on-error < "$DUMP"

rm -rf volumes/storage.old
mv volumes/storage volumes/storage.old
tar --xattrs --xattrs-include='user.*' -xzf "$FILES" -C volumes
rm -rf volumes/storage.old

docker compose start imgproxy storage app
echo "Восстановлено из $(basename "$DUMP")."
