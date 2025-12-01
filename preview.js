const { default: axios } = require("axios");
const probe = require("probe-image-size");
const { getPreviewFromContent } = require("link-preview-js");
const { makeUrl, extractVideoId, getVideoDetails } = require("./utils");

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

  const response = await axios.get(url);
  const data = await getPreviewFromContent({ ...response, url });
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
