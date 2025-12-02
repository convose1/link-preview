var bodyParser = require("body-parser");
const express = require("express"),
  cors = require("cors");
const { buildPreviewResponse } = require("./preview");
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
    const preview = await buildPreviewResponse(req.body?.url);
    return res.status(200).json(preview);
  } catch (error) {
    return res.status(401).json({ message: error?.message });
  }
});

const server = app.listen(process.env.PORT || 4000, function () {
  console.log("app runing on port  " + server.address().port);
});
