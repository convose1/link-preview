const { default: axios } = require("axios");
var bodyParser = require("body-parser");
const express = require("express"),
  cors = require("cors");
require("dotenv").config();
const { getPreviewFromContent } = require("link-preview-js");
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
    getPreviewFromContent({ ...response, url }).then((data) => {
      return res.status(200).json(data);
    });
  } catch (error) {
    return res.status(401).json({ message: error?.message });
  }
});

const server = app.listen(process.env.PORT || 3000, function () {
  console.log("app runing on port  " + server.address().port);
});
