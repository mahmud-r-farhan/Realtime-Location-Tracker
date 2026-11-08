#!/bin/sh
set -eu
for file in public/js/*.js; do
  node --input-type=module --check < "$file"
done
node --check public/sw.js
for file in src/*.js src/*/*.js tests/*.js tests/browser/*.js; do
  node --check "$file"
done
