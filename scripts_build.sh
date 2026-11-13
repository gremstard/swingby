#!/bin/sh
# Cuts a milestone build: vite build -> build/perihelion-<tag>.zip, tags git.
set -e
TAG=$1; [ -z "$TAG" ] && { echo "usage: sh scripts_build.sh M1"; exit 1; }
npm run build --silent
mkdir -p build && rm -f build/swingby-$TAG.zip
(cd dist && zip -qr ../build/swingby-$TAG.zip .)
git add -A && git commit -qm "build: $TAG" && git tag -f $TAG
ls -la build/swingby-$TAG.zip
