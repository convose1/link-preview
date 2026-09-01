#!/bin/bash
# Link Preview Lambda Deployment Script
#
# Same sequence as ai/deploy.sh and translation/deploy.sh in the
# convosetranslation repo — clean, test, production-only install from the
# lockfile, zip, report size, print the update-function-code command — so all
# three Convose Lambdas are built the same way. See DEPLOYMENT.md.
set -euo pipefail

# Always run from the script directory so paths are correct
SCRIPT_DIR="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
cd "$SCRIPT_DIR"

ZIP="link-preview.zip"

# Files that make up the Lambda. An explicit include list, NOT "everything
# except": it fails closed, so a new file is absent from the artifact until
# someone adds it here rather than shipping by default. This is what keeps
# app.js — and with it express, body-parser and cors — out.
# Keep in step with SHIPPED_FILES in __tests__/package.test.js; that test fails
# if the two disagree.
SHIPPED=(handler.js index.js preview.js utils package.json yarn.lock)

echo "Building Link Preview Lambda in ${SCRIPT_DIR}..."

echo "Cleaning previous artifact..."
rm -f "$ZIP"

# The gate runs against the repo's normal dev tree, so make sure it is complete.
#
# --check-files, and NOT a bare `[ -d node_modules ]` test, because a directory
# that exists can still be the wrong tree. An earlier version of this script
# installed --production into the repo, leaving node_modules holding only the
# 52 production packages while yarn's integrity record still claimed the
# install was fine — so a plain `yarn install` answered "Already up-to-date"
# and never restored express, body-parser, cors or nodemon. --check-files
# verifies what is actually on disk against the lockfile and repairs it.
#
# Deliberately NOT --frozen-lockfile: this install is a convenience for the
# tests, and failing here on lockfile drift would block a build for a reason
# that has nothing to do with the artifact. The staging install below is the
# one that must match the lockfile exactly.
echo "Checking dependencies for the test gate..."
yarn install --check-files

# Guard the deployment package before building it. No network calls, no
# framework: the tests assert the artifact loads, ships every file it
# references, and does NOT ship the dev server or its dependencies. A wrong
# package fails at runtime as an opaque API Gateway 500.
echo "Running tests..."
yarn --silent test

# Build in a staging directory, never in the repo.
#
# The previous version installed into the repo's own node_modules. That is what
# made builds destructive: `yarn install --production` REWRITES yarn.lock,
# stripping every devDependency entry from it, so each build dirtied the tree
# and left a lockfile that a later full `yarn install --frozen-lockfile`
# rejects with "Your lockfile needs to be updated". Staging removes the whole
# class of problem — the repo's node_modules and yarn.lock are never touched,
# and there is no restore step that can fail to run.
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

echo "Staging artifact files..."
for f in "${SHIPPED[@]}"; do
  if [ ! -e "$f" ]; then
    echo "ERROR: $f is listed in SHIPPED but does not exist." >&2
    exit 1
  fi
  cp -R "$f" "$STAGING/"
done

echo "Installing production dependencies..."
(
  cd "$STAGING"
  # --frozen-lockfile so the artifact matches yarn.lock rather than silently
  # resolving something new. Safe to enforce here: this lockfile is a throwaway
  # copy, so whatever yarn writes to it is discarded with the staging dir.
  yarn install --production --frozen-lockfile --non-interactive
)

echo "Creating deployment package..."
( cd "$STAGING" && zip -qr "$SCRIPT_DIR/$ZIP" . )

echo "Deployment package created: ${SCRIPT_DIR}/${ZIP}"
echo "Size: $(ls -lh "$ZIP" | awk '{print $5}')"
echo ""
echo "To deploy manually via AWS CLI:"
echo "  aws lambda update-function-code --function-name link-preview --region eu-west-3 --zip-file fileb://link-preview.zip"
