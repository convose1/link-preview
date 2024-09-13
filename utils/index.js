const { default: axios } = require("axios");

require("dotenv").config();
const makeUrl = ({ url }) => {
  if (!url || url == "") {
    throw new Error("not valid link");
  }
  let newUrl = url;
  if (!/^https?:\/\//i.test(url)) {
    newUrl = "http://" + url;
  }
  return newUrl;
};

const extractVideoId = (url) => {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|embed)\/|.+[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const matches = url.match(regex);
  return matches ? matches[1] : null;
};

const API_KEY = process.env.API_KEY; //YouTube Data API key
const getVideoDetails = async (videoId, url) => {
  try {
    const endpoint = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${API_KEY}&part=snippet,contentDetails,statistics`;
    const response = await axios.get(endpoint);
    const videoDetails = response.data.items[0];

    if (videoDetails) {
      const { medium } = videoDetails.snippet.thumbnails;
      const ratio = medium.width / medium.height;
      const images = [medium.url];
      return {
        title: videoDetails.snippet.title,
        description: videoDetails.snippet.description,
        siteName: "YouTube",
        url,
        videoId,
        ratio,
        images,
      };
    } else {
      return { error: "No video found with the provided ID." };
    }
  } catch (error) {
    return { error: "Error fetching video details." };
  }
};

module.exports = { makeUrl, extractVideoId, getVideoDetails };
