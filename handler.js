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
  if (typeof event.body === "string") {
    try {
      return JSON.parse(event.body);
    } catch (error) {
      return {};
    }
  }
  return event.body;
};

module.exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return respond(200, { message: "ok" });
    }

    if (event.httpMethod === "GET") {
      return respond(200, { message: "Hello there!" });
    }

    if (event.httpMethod !== "POST") {
      return respond(405, { message: "Method Not Allowed" });
    }

    const body = parseBody(event);
    const preview = await buildPreviewResponse(body?.url);

    return respond(200, preview);
  } catch (error) {
    return respond(400, { message: error?.message || "Unable to generate preview" });
  }
};
