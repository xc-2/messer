#!/usr/bin/bash

set -e

if [ -n "$GIT_REPO" ]; then
  cd $GIT_REPO
fi

if [ -z "$(git status --porcelain)" ]; then
  echo Repo is clean: $GIT_REPO
  exit ${CODE_NO_CHANGE:-0}
fi

git add .
git commit -m "${GIT_COMMIT_MSG:-Auto update}"

if [ -n "$GIT_PUSH" ]; then
  git push
fi
