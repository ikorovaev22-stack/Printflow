#!/bin/sh
#
# Backup of everything the app stores: database rows (app data, accounts, file records) and uploaded files.
# install.sh runs it every night via /etc/cron.d/printflow-backup; restore with deploy/restore.sh.
#
#   sh deploy/backup.sh          # → deploy/backups/<date>_db.dump and <date>_files.tar.gz
#
# Backups are kept on the same disk for KEEP_DAYS days (default 14). With BACKUP_S3_* in deploy/.env each run also
# copies them to S3-compatible storage (in Russia: Selectel, Yandex Object Storage, VK Cloud).

set -e

cd "$(dirname "$0")"
DEPLOY_DIR=$(pwd)
OUT="$DEPLOY_DIR/backups"
KEEP_DAYS=${KEEP_DAYS:-14}
stamp=$(date +%Y-%m-%d_%H%M)

mkdir -p "$OUT"
chmod 700 "$OUT"
cd supabase

# Data only: the schema comes from supabase/migrations and the Supabase images on restore
docker compose exec -T db pg_dump -U supabase_admin -d postgres -Fc --data-only \
  --schema=public --schema=auth --schema=storage \
  --exclude-table=auth.schema_migrations --exclude-table=storage.migrations \
  > "$OUT/${stamp}_db.dump.tmp"
mv "$OUT/${stamp}_db.dump.tmp" "$OUT/${stamp}_db.dump"

# Storage keeps each file's content type and etag in extended attributes, so they go into the archive too
tar --xattrs --xattrs-include='user.*' -czf "$OUT/${stamp}_files.tar.gz" -C volumes storage

find "$OUT" -type f -name '20*' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') бэкап готов: $OUT/${stamp}_db.dump, ${stamp}_files.tar.gz"

# Off-site copy: upload new files, then drop remote ones older than KEEP_DAYS. Copy + age-based delete rather than
# sync, so a rebuilt server with an empty backups folder never wipes the remote copies.
cd "$DEPLOY_DIR"
conf() {
  sed -n "s/^$1=//p" .env 2>/dev/null | tail -n1 | sed -e 's/\r$//' -e "s/^\"\(.*\)\"$/\1/" -e "s/^'\(.*\)'$/\1/"
}
BUCKET=$(conf BACKUP_S3_BUCKET)
[ -n "$BUCKET" ] || exit 0
REMOTE="s3:$BUCKET/$(conf BACKUP_S3_PREFIX)"
RCLONE_ENV=$(mktemp)
trap 'rm -f "$RCLONE_ENV"' EXIT
chmod 600 "$RCLONE_ENV"
cat > "$RCLONE_ENV" <<EOF
RCLONE_CONFIG_S3_TYPE=s3
RCLONE_CONFIG_S3_PROVIDER=Other
RCLONE_CONFIG_S3_ENDPOINT=$(conf BACKUP_S3_ENDPOINT)
RCLONE_CONFIG_S3_REGION=$(conf BACKUP_S3_REGION)
RCLONE_CONFIG_S3_ACCESS_KEY_ID=$(conf BACKUP_S3_ACCESS_KEY)
RCLONE_CONFIG_S3_SECRET_ACCESS_KEY=$(conf BACKUP_S3_SECRET_KEY)
EOF
rclone() {
  docker run --rm --env-file "$RCLONE_ENV" -v "$OUT:/backups:ro" rclone/rclone:1 "$@"
}
rclone copy /backups "$REMOTE" --include '20*' --s3-no-check-bucket
rclone delete "$REMOTE" --min-age "${KEEP_DAYS}d"
echo "$(date '+%F %T') копия в хранилище: $REMOTE"
