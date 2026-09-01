const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pkg = require("../package.json");
// deploy.sh is the single definition of what goes into the zip; `yarn package`
// delegates to it. Assert against the script, not against package.json, so the
// two cannot drift.
const deployScript = fs.readFileSync(path.join(root, "deploy.sh"), "utf8");

// These tests exist to gate `./deploy.sh`, matching the ai/ and translation/
// Lambdas in the convosetranslation repo. They deliberately make no network
// calls and need no framework: a deploy gate that is slow or flaky gets
// skipped, and a skipped gate is not a gate.
//
// What they protect is the one thing that has actually broken these functions:
// a deployment package that is missing something, or carrying something it
// should not. A wrong package fails at runtime as an opaque API Gateway 500.

// ---------------------------------------------------------------------------
// The artifact loads
// ---------------------------------------------------------------------------

test("index.js exposes the handler AWS is configured to call", () => {
  // Lambda is configured with handler `index.handler`. If this export ever
  // stops being a function, every request 500s with nothing useful logged.
  const index = require("../index");
  assert.equal(typeof index.handler, "function");
});

test("the preview path loads and exports its entry point", () => {
  const { buildPreviewResponse } = require("../preview");
  assert.equal(typeof buildPreviewResponse, "function");
});

// ---------------------------------------------------------------------------
// The artifact contains what it needs, and nothing it does not
// ---------------------------------------------------------------------------

const SHIPPED_FILES = ["handler.js", "index.js", "preview.js", "utils"];

test("every file the package script ships exists", () => {
  for (const f of SHIPPED_FILES) {
    assert.ok(fs.existsSync(path.join(root, f)), `${f} is zipped but missing`);
  }
  for (const f of SHIPPED_FILES) {
    assert.match(deployScript, new RegExp(`^\\s*${f.replace(".", "\\.")}\\s*\\\\?$`, "m"),
      `${f} exists but deploy.sh does not ship it`);
  }
});

test("app.js is NOT shipped — it is the local dev server", () => {
  // app.js is the express server used only by `yarn dev`/`yarn start`. It is
  // excluded on purpose, which is what lets express/body-parser/cors stay out
  // of the deployment package entirely.
  assert.doesNotMatch(deployScript, /^\s*app\.js\s*\\?$/m);
});

test("the dev server's dependencies stay out of production", () => {
  // Regression guard. These sat in `dependencies` and were installed into the
  // artifact by `yarn install --production`, dragging their advisories with
  // them, despite nothing in the shipped files requiring them.
  for (const dep of ["express", "body-parser", "cors", "nodemon"]) {
    assert.ok(!(dep in (pkg.dependencies || {})),
      `${dep} belongs in devDependencies — the Lambda never loads it`);
  }
});

test("every runtime dependency is actually required by a shipped file", () => {
  const sources = ["handler.js", "index.js", "preview.js", "utils/index.js"]
    .map((f) => fs.readFileSync(path.join(root, f), "utf8"))
    .join("\n");

  for (const dep of Object.keys(pkg.dependencies || {})) {
    assert.match(sources, new RegExp(`require\\(["']${dep}["']\\)`),
      `${dep} is a production dependency but nothing shipped requires it`);
  }
});

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

test("no .env is shipped — configuration comes from Lambda env vars", () => {
  // Unlike the ai/ and translation/ Lambdas, which ship a .env, this function
  // reads API_KEY from the Lambda's own environment. Keep it that way: a .env
  // inside the zip is a committed-secret risk and drifts from the console.
  assert.doesNotMatch(deployScript, /^\s*\.env\s*\\?$/m);
  assert.match(fs.readFileSync(path.join(root, ".gitignore"), "utf8"), /^\.env$/m);
});
