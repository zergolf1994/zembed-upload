"use strict";
const fs = require("fs-extra");
const path = require("path");
const mime = require("mime-types");
const { Generate } = require(`../Utils`);

module.exports = async (req, res) => {
  try {
    let FileUpload = req?.files?.video;

    FileUpload.name = Buffer.from(FileUpload.name, "latin1").toString("utf8");

    if (FileUpload.size > global.limitUpload) {
      return res.status(413).end();
    }
    let data = {
      slug: await Generate.FileSlug(),
    };
    const ext = mime.extension(FileUpload.mimetype);

    if (!fs.existsSync(global.dirUpload)) fs.mkdirSync(global.dirUpload);

    let uploadPath = path.join(global.dirUpload, `${data.slug}.${ext}`);
    FileUpload.mv(uploadPath, async function (err) {
      return res.status(200).json({ status: true, data });
    });
  } catch (error) {
    console.log(error);
    return res.status(403).json({ status: false });
  }
};
