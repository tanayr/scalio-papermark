#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/scalio-invest
exec 9>/run/lock/scalio-invest-backup.lock
flock -n 9 || exit 0
mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="backups/.partial-${stamp}"
mkdir "$target"
trap 'docker compose start app >/dev/null 2>&1 || true' EXIT
# Stop only this app, waiting for active uploads before taking a consistent pair.
docker compose stop -t 150 app
docker compose exec -T db pg_dump -U invest -d invest -Fc > "$target/database.dump"
docker run --rm --network none --entrypoint tar -v scalio-invest_documents:/data:ro scalio/invest:local -czf - -C /data . > "$target/documents.tar.gz"
cp .env "$target/deployment.env"
docker compose start app
mv "$target" "backups/${stamp}"
find backups -mindepth 1 -maxdepth 1 -type d -name '20*T*Z' -mtime +7 -exec rm -rf -- {} +
echo "Scalio investor room backup complete: ${stamp}"
