#!/bin/bash
# Link Preview Lambda Deployment Script
#
# Same shape as ai/deploy.sh and translation/deploy.sh in the convosetranslation
# repo, so all three Convose Lambdas are built the same way:
#   clean -> test -> production install -> zip -> report size -> print the
#   update-function-code command.
#
# Two deliberate differences from those two, both documented in DEPLOYMENT.md:
#   1. yarn with a frozen lockfile, not `npm install --production`.
#   2. the zip lists the files to INCLUDE rather than excluding a denylist.
set -euo pipefail

# Always run from the script directory so paths are correct
SCRIPT_DIR="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
cd "$SCRIPT_DIR"

LOCKFILE_BACKUP="$(mktemp)"
trap 'rm -f "$LOCKFILE_BACKUP"' EXIT

echo "Building Link Preview Lambda in ${SCRIPT_DIR}..."

# Clean the previous artifact. node_modules is deliberately NOT removed yet —
# the tests below load the real modules, so wiping the tree first makes them
# fail with MODULE_NOT_FOUND instead of testing anything.
echo "Cleaning previous artifact..."
rm -f link-preview.zip

# Make sure the full tree (including devDependencies) is present and matches the
# lockfile, so the gate below runs against what the repo actually declares.
echo "Installing dependencies for the test gate..."
yarn install --frozen-lockfile

# Guard the deployment package before anything gets built. These tests make no
# network calls and need no framework — they assert the artifact loads, ships
# every file it references, and does NOT ship the dev server or its
# dependencies. A wrong package fails at runtime as an opaque API Gateway 500,
# which is exactly the failure worth spending a second to prevent.
echo "Running tests..."
yarn --silent test

# Now rebuild the tree production-only. Removed outright rather than pruned:
# the artifact must match the lockfile exactly, and a leftover dev tree is the
# difference between shipping express and not.
#
# yarn.lock is saved and restored around this: `yarn install --production`
# REWRITES the lockfile, dropping every devDependency entry from it. Left alone
# that means each build dirties the repo and quietly discards the dev half of
# the lockfile, so the next full install re-resolves it unpinned.
echo "Rebuilding node_modules production-only..."
cp yarn.lock "$LOCKFILE_BACKUP"
rm -rf node_modules
yarn install --production --frozen-lockfile
cp "$LOCKFILE_BACKUP" yarn.lock

# Create deployment package.
#
# An explicit include list, NOT `zip -r . -x ...`. This is what keeps app.js —
# and with it express, body-parser and cors — out of the artifact, and it fails
# closed: a new file is absent until someone adds it here, rather than shipping
# by default. Add new runtime files to SHIPPED_FILES in __tests__/package.test.js
# at the same time; that test fails if the two disagree.
echo "Creating deployment package..."
zip -qr link-preview.zip \
  handler.js \
  index.js \
  preview.js \
  utils \
  package.json \
  yarn.lock \
  node_modules

echo "Deployment package created: ${SCRIPT_DIR}/link-preview.zip"
echo "Size: $(ls -lh link-preview.zip | awk '{print $5}')"
echo ""
echo "To deploy manually via AWS CLI:"
echo "  aws lambda update-function-code --function-name link-preview --region eu-west-3 --zip-file fileb://link-preview.zip"
echo ""
echo "node_modules is production-only now — run 'yarn install' to restore dev deps."
