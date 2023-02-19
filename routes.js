"use strict";

const express = require("express");
const router = express.Router();
const { AuthJwt } = require("./Utils");
const Control = require("./Controllers");
//data
//router.route("/").post(AuthJwt, Control.Upload.Files);
router.route("/").post(AuthJwt, Control.Test);


router.route("/server/create").get(Control.Server.Create);

router.all("*", async (req, res) => {
  res.status(500).end();
});

module.exports = router;
