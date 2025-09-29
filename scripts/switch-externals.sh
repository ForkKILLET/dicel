#!/usr/bin/env sh

ROOT=$(dirname "$0")/..

if [[ "$1" != on && "$1" != off ]]; then
  exit 1
fi

echo "switching $1 externals"

case "$1" in
  (on)
    if [[ -d $ROOT/externals.disabled ]]; then
      mv $ROOT/externals.disabled $ROOT/externals
      rm $ROOT/pnpm-lock.yaml
      pnpm install
    fi
    ;;
  (off)
    if [[ -d $ROOT/externals ]]; then
      mv $ROOT/externals $ROOT/externals.disabled
      rm $ROOT/pnpm-lock.yaml
      pnpm install
    fi
    ;;
esac