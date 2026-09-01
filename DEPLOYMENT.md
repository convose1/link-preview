# Building and deploying this Lambda

Convose runs three Node Lambdas. They are built the same way on purpose, so
that knowing one is knowing all three:

| Function | Repo / directory | Build |
|---|---|---|
| Ask AI | `convosetranslation/ai` | `./deploy.sh` |
| Translate | `convosetranslation/translation` | `./deploy.sh` |
| Link preview | this repo | `./deploy.sh` (or `yarn package`) |

## The sequence

Every one of them runs the same steps, in this order:

1. **Clean the previous artifact.** Never reuse a zip.
2. **Run the test gate.** The deploy fails here rather than in production.
3. **Install production-only dependencies**, from the lockfile.
4. **Zip the artifact.**
5. **Report the size**, and print the exact `update-function-code` command.

**The production install happens in a staging directory, never in the repo.**
That is not a detail — `yarn install --production` *rewrites* `yarn.lock`,
stripping every devDependency entry from it. Installing into the repo means
each build dirties the tree and leaves a lockfile that the next full
`yarn install --frozen-lockfile` rejects with *"Your lockfile needs to be
updated"*. Staging removes the whole class of problem: the repo's
`node_modules` and `yarn.lock` are never touched.

## Building here

```bash
./deploy.sh          # or: yarn package
```

`deploy.sh` is the single definition of what goes into the zip. `yarn package`
delegates to it, so the two cannot drift.

The build is non-destructive and repeatable: it does not modify `node_modules`,
`yarn.lock` or anything else tracked, so `git status` is unchanged afterwards
and the dev server still works.

If you hit *"Your lockfile needs to be updated, but yarn was run with
`--frozen-lockfile`"*, an earlier build damaged the lockfile. Recover with:

```bash
git checkout yarn.lock
rm -f package-lock.json   # this repo uses yarn; an npm lockfile here is a second source of truth
```

## What the artifact contains

An explicit **include list**, not "everything except". It fails closed: a new
file is absent from the zip until someone adds it to `deploy.sh`, rather than
shipping by default.

Shipped: `handler.js`, `index.js`, `preview.js`, `utils/`, `package.json`,
`yarn.lock`, and a production-only `node_modules/`.

Never shipped: `app.js` (the local express dev server) and with it `express`,
`body-parser`, `cors` and `nodemon`. They are `devDependencies`; nothing the
Lambda loads requires them. They were in `dependencies` once, which put them —
and their advisories — into every deployment package for no reason.

`__tests__/package.test.js` enforces all of the above, including that a
production dependency is one a shipped file actually requires. Add a new
runtime file to `deploy.sh` and to `SHIPPED_FILES` in that test together.

## Deploying

```bash
aws lambda update-function-code \
  --function-name link-preview \
  --region eu-west-3 \
  --zip-file fileb://link-preview.zip
```

## Function configuration

Config lives in the AWS console, not in this repo, so it survives code deploys
and has to be checked separately.

- **Environment variables** — `API_KEY` (YouTube Data API v3). This function
  reads configuration from the Lambda environment and ships **no `.env`**. Keep
  it that way: a `.env` inside a zip is a committed-secret risk and drifts
  silently from the console.
- **Handler** — `index.handler`.
- **Timeout — at least 15s.** The default 3s is far too short. This is not
  hypothetical: on 2026-09-01 the Ask AI Lambda was returning HTTP 500 for every
  answer that took longer than about three seconds, and CloudWatch showed
  `Duration: 3000.00 ms ... Status: timeout`. Link preview has the same
  exposure — it fetches third-party sites, and slow ones are common.
- **Memory — at least 512MB.** Lambda scales CPU with memory, so 128MB is not
  just a memory floor, it is the slowest possible CPU. The Ask AI function was
  measured using 96-102MB of a 128MB allocation: near the ceiling *and*
  throttled.

### Telling a timeout apart from a handled error

The response body says which, and this is the fastest diagnosis available:

- `{"message":"Internal Server Error"}` — **API Gateway**. The function died:
  timed out, crashed, or ran out of memory. Nothing in our code emits this.
- Any structured body of ours — the function ran and replied.

## Verifying a deploy

These endpoints take a plain POST and no authentication, so a deploy can be
checked directly. Do it before and after, not just after: knowing the previous
behaviour is what makes a difference meaningful.

```bash
curl -s -X POST "$LINK_PREVIEW_URL" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://github.com/axios/axios"}' \
  -w '\nhttp=%{http_code} t=%{time_total}s\n'
```

Worth checking a slow site and a redirecting one, not only a fast one — the
failures here are latency-shaped.

## Rolling back

There is no automatic rollback. Keep the previous `link-preview.zip`, or
rebuild from the previous commit and re-upload. Config changes (timeout,
memory, env vars) roll back separately in the console; a code rollback does not
touch them.

## Where the other two differ

Same five steps, two differences worth knowing before copying a command
between repos:

- They use **npm** (`npm test`, `npm install --production`); this repo uses
  **yarn** with `--frozen-lockfile`.
- They zip **everything except a denylist** and **do ship a `.env`**. That
  `.env` carries `AWS_BEDROCK_REGION`, and excluding it once moved Bedrock to
  the function's own region, where the model does not exist — every call died
  as a ~270ms `ValidationException`. If you edit either of those deploy
  scripts, leave `.env` in.
