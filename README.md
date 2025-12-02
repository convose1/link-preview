## Link preview (Express + AWS Lambda)

### Local development
- `yarn install`
- `API_KEY=<youtube-api-key> PORT=4000 yarn start`
- POST `/{ url: "https://example.com" }` to `http://localhost:4000` to get the preview JSON.

### AWS Lambda
- Runtime: Node.js 18.x (or later)
- Handler: `handler.handler` (or leave default `index.handler`—`index.js` now re-exports the handler)
- Environment variables: `API_KEY` for YouTube Data API v3
- Behind API Gateway, map `GET /` to the handler (returns `{ message: "Hello there!" }`) and `POST /` with a JSON body `{ "url": "<link>" }` to retrieve the preview data. CORS headers are included in the Lambda response; enable CORS on API Gateway to match.
