#!/usr/bin/env sh

ROOT=$(dirname "$0")/..

if [[ "$1" != on && "$1" != off ]]; then
  exit 1
fi

echo "switching $1 externals"

case "$1" in
  (on)
    pnpm link ~/src/fk-result
    pnpm link ~/src/parsecond
    ;;
  (off)
    pnpm unlink fk-result
    pnpm unlink parsecond
    ;;
esac
