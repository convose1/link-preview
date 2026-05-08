## Link preview (Express + AWS Lambda)

### Local development
- `yarn install`
- `API_KEY=<youtube-api-key> PORT=4000 yarn start`
- POST `/{ url: "https://example.com" }` to `http://localhost:4000` to get the preview JSON.

### AWS Lambda
- Runtime: Node.js 18.x (or later)
- Handler: `handler.handler` (or leave default `index.handler`—`index.js` now re-exports the handler)
- Environment variables: `API_KEY` for YouTube Data API v3
- Timeout: at least 10s. The default 3s is too short for sites with redirects or slow responses (github.com, bbc.com, sonarcloud.io) and surfaces as opaque API Gateway 500s.
- Behind API Gateway, map `GET /` to the handler (returns `{ message: "Hello there!" }`) and `POST /` with a JSON body `{ "url": "<link>" }` to retrieve the preview data. CORS headers are included in the Lambda response; enable CORS on API Gateway to match.

### Build the deploy artifact
```bash
yarn package
```
Produces `link-preview.zip` containing `handler.js`, `index.js`, `preview.js`, `utils/`, `package.json`, `yarn.lock`, and a production-only `node_modules/`. The script wipes `node_modules` first to make the install reproducible — run `yarn install` afterwards to restore dev deps for local work.

### Deploy to AWS Lambda
Replace `link-preview` with the actual function name and `eu-west-3` with the function's region:

```bash
yarn package

aws lambda update-function-code \
  --function-name link-preview \
  --region eu-west-3 \
  --zip-file fileb://link-preview.zip

# One-time (only needed when changing config):
aws lambda update-function-configuration \
  --function-name link-preview \
  --region eu-west-3 \
  --timeout 15
```
