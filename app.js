const { default: axios } = require("axios");
const probe = require("probe-image-size");
var bodyParser = require("body-parser");
const { getPreviewFromContent } = require("link-preview-js");
const { makeUrl, extractVideoId, getVideoDetails } = require("./utils");
const express = require("express"),
  cors = require("cors");
require("dotenv").config();
const app = express();
app.use(cors());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.get("/", async (_, res) => {
  res.status(200).json({ message: "Hello there!" });
});

app.post("/", async (req, res) => {
  try {
    const url = makeUrl(req.body);
    let tweetId = null;

    // check if it is an x.com post
    if (url && url.startsWith("https://x.com/")) {
      // Extract tweet ID from URL
      const tweetIdMatch = url.match(/\/status\/(\d+)/);
      if (tweetIdMatch) {
        tweetId = tweetIdMatch[1];
      }
    }

    //if it is youtube video, we use youtube data api3 to fetch details of video
    const videoId = extractVideoId(url);
    if (videoId) {
      const video = await getVideoDetails(videoId, url);
      return res.status(200).json(video);
    }

    const response = await axios.get(url);
    getPreviewFromContent({ ...response, url }).then(async (data) => {
      let newData = data;
      const imagesource = data?.images[0] || null;
      if (imagesource) {
        try {
          let result = await probe(imagesource);
          const ratio = Number((result.width / result.height).toFixed(2));
          newData = {
            ...newData,
            ratio,
          };
        } catch (error) {
          newData = {
            ...newData,
            ratio: 1,
          };
        }
      }

      // check here if it is x post
      if (tweetId) {
        newData = { ...newData, tweetId };
      }
      return res.status(200).json(newData);
    });
  } catch (error) {
    return res.status(401).json({ message: error?.message });
  }
});

const server = app.listen(process.env.PORT || 4000, function () {
  console.log("app runing on port  " + server.address().port);
});
