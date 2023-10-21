#!/usr/bin/env bash

set -e

RESTIC=${RESTIC:-restic}
MESSER=$(dirname $0)

if [ -z "$RESTIC_DATA_PATH" ]; then
  echo 'RESTIC_DATA_PATH is required'
  exit 1
fi

echo Backing up $RESTIC_DATA_PATH to $RESTIC_REPOSITORY
cd $RESTIC_DATA_PATH

added=$($RESTIC backup -qn $RESTIC_OPTS --json . | jq .data_added)

if [[ "$added" == "0" ]]; then
  echo Repo is up to date: $RESTIC_DATA_PATH
  exit ${CODE_NO_CHANGE:-0}
fi

$RESTIC -v backup $RESTIC_OPTS .
