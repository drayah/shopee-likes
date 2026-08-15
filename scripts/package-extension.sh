#!/bin/sh

set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=$(node -p "require('$repo_root/manifest.json').version")
package_version=$(node -p "require('$repo_root/package.json').version")
artifact="$repo_root/dist/shopee-likes-$version.zip"

if [ "$version" != "$package_version" ]; then
  printf 'manifest.json and package.json versions do not match\n' >&2
  exit 1
fi

mkdir -p "$repo_root/dist"
rm -f "$artifact"

cd "$repo_root"
zip -X -q -r "$artifact" manifest.json src icons LICENSE
unzip -q -t "$artifact"

printf '%s\n' "$artifact"
