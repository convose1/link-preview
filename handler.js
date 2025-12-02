const { buildPreviewResponse } = require("./preview");

const defaultHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
  "Content-Type": "application/json",
};

const respond = (statusCode, payload) => ({
  statusCode,
  headers: defaultHeaders,
  body: JSON.stringify(payload),
});

const parseBody = (event) => {
  if (!event.body) return {};
  const rawBody =
    event.isBase64Encoded && typeof event.body === "string"
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;

  if (typeof rawBody === "string") {
    try {
      return JSON.parse(rawBody);
    } catch (error) {
      return {};
    }
  }
  return rawBody;
};

module.exports.handler = async (event) => {
  try {
    const method = event?.httpMethod || event?.requestContext?.http?.method || "";

    if (method === "OPTIONS") {
      return respond(200, { message: "ok" });
    }

    if (method === "GET") {
      return respond(200, { message: "Hello there!" });
    }

    if (method !== "POST") {
      return respond(405, { message: "Method Not Allowed" });
    }

    const body = parseBody(event);
    const preview = await buildPreviewResponse(body?.url);

    return respond(200, preview);
  } catch (error) {
    return respond(400, { message: error?.message || "Unable to generate preview" });
  }
};
