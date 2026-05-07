const { default: axios } = require("axios");
const probe = require("probe-image-size");
const { getPreviewFromContent } = require("link-preview-js");
const { makeUrl, extractVideoId, getVideoDetails } = require("./utils");

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Bound each outbound fetch so the function returns a clean 4xx via the
// handler's catch block instead of being killed by the Lambda runtime
// timeout (which surfaces as an opaque API Gateway 500).
const FETCH_TIMEOUT_MS = 8000;

const fetchViaProxy = async (url) => {
  const proxiedUrl = `https://r.jina.ai/${url}`;
  const response = await axios.get(proxiedUrl, {
    headers: FETCH_HEADERS,
    maxRedirects: 5,
    timeout: FETCH_TIMEOUT_MS,
  });
  return response.data;
};

const buildPreviewFromProxyContent = (content, url) => {
  const titleMatch = content.match(/^Title:\s*(.+)$/m);
  const imageMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  const descriptionMatch = content
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line && !line.startsWith("Title:") && !line.startsWith("URL Source:"))[0];

  return {
    title: titleMatch ? titleMatch[1].trim() : url,
    description: descriptionMatch ? descriptionMatch.trim() : "",
    siteName: new URL(url).hostname,
    url,
    images: imageMatch ? [imageMatch[1]] : [],
    ratio: 1,
  };
};

/**
 * Generates link preview data for the provided URL.
 * Returns the same shape as the existing Express endpoint.
 */
const buildPreviewResponse = async (rawUrl) => {
  const url = makeUrl({ url: rawUrl });
  let tweetId = null;

  if (url && url.startsWith("https://x.com/")) {
    const tweetIdMatch = url.match(/\/status\/(\d+)/);
    if (tweetIdMatch) {
      tweetId = tweetIdMatch[1];
    }
  }

  const videoId = extractVideoId(url);
  if (videoId) {
    return getVideoDetails(videoId, url);
  }

  let data;
  try {
    const response = await axios.get(url, {
      headers: FETCH_HEADERS,
      maxRedirects: 5,
      timeout: FETCH_TIMEOUT_MS,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    data = await getPreviewFromContent({ ...response, url });
  } catch (error) {
    const status = error?.response?.status;
    if (status && [403, 429, 503].includes(status)) {
      try {
        const proxyContent = await fetchViaProxy(url);
        data = buildPreviewFromProxyContent(proxyContent, url);
      } catch (proxyError) {
        throw error;
      }
    } else {
      throw error;
    }
  }
  let newData = data;
  const imagesource = data?.images?.[0] || null;

  if (imagesource) {
    try {
      const result = await probe(imagesource);
      const ratio = Number((result.width / result.height).toFixed(2));
      newData = {
        ...newData,
        ratio,
      };
    } catch (error) {
      newData = {
        ...newData,
        images: [],
        ratio: 1,
      };
    }
  }

  if (tweetId) {
    newData = { ...newData, tweetId };
  }

  return newData;
};

module.exports = { buildPreviewResponse };
