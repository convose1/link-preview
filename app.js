const { default: axios } = require("axios");
const probe = require("probe-image-size");
var bodyParser = require("body-parser");
const express = require("express"),
  cors = require("cors");
require("dotenv").config();
const { getPreviewFromContent } = require("link-preview-js");
const youtube_parser = (url) => {
  const regExp =
    /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|live\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[1].length == 11 ? match[1] : false;
};
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
    const response = await axios.get(url);
    getPreviewFromContent({ ...response, url }).then(async (data) => {
      console.log("data ---", data);

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
      // check here if it is youtube video
      if (newData.mediaType == "video.other") {
        const videoId = youtube_parser(url);
        newData = { ...newData, videoId };
      }
      console.log("newData ---", newData);
      return res.status(200).json(newData);
    });
  } catch (error) {
    return res.status(401).json({ message: error?.message });
  }
});

const server = app.listen(process.env.PORT || 4000, function () {
  console.log("app runing on port  " + server.address().port);
});
