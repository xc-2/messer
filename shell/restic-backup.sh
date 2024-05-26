#!/usr/bin/env bash

set -e

RESTIC=${RESTIC:-restic}
RESTIC_DATA_PATH=${RESTIC_DATA_PATH:-.}

if [ -z "$RESTIC_DATA_ROOT" ]; then
  echo 'RESTIC_DATA_ROOT is required'
  exit 1
fi

echo Backing up from $RESTIC_DATA_ROOT to $RESTIC_REPOSITORY: $RESTIC_DATA_PATH
cd $RESTIC_DATA_ROOT

if ! $RESTIC backup -qn $RESTIC_OPTS --json $RESTIC_DATA_PATH | jq '.files_new, .files_changed, .dirs_new, .dirs_changed, .data_added' | grep -v '^0$' > /dev/null; then
  echo Repo is up to date: $RESTIC_DATA_ROOT
  exit ${CODE_NO_CHANGE:-0}
fi

$RESTIC -v backup $RESTIC_OPTS $RESTIC_DATA_PATH
