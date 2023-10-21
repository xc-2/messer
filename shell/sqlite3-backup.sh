#!/usr/bin/env bash
#
# Back up the SQLite database if there are changes.
#
# Usage: sqlite3-backup.sh source.sqlite3 backup.sql

set -e

SOURCE=$1
BACKUP=$2

if [ ! -f "$SOURCE" ] || [ -z "$BACKUP" ]; then
  echo Usage: sqlite3-backup.sh source.sqlite3 target.sqlite3
  exit 1
fi

TEMP=$(mktemp)
sqlite3 $SOURCE '.dump' > $TEMP

if [ -f "$BACKUP" ] && diff "$TEMP" "$BACKUP" > /dev/null; then
  echo No change is detected: $SOURCE
  rm $TEMP
  exit ${CODE_NO_CHANGE:-0}
fi

mv $TEMP $BACKUP
