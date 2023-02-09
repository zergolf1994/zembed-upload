"use strict";
const fs = require("fs-extra");
const path = require("path");
const mime = require("mime-types");

const { Files } = require(`../Models`);
const { SCP, Generate, Alert, GetOne, Get_Video_Data } = require(`../Utils`);

module.exports = async (req, res) => {
  try {
    let { uid } = req.user;
    if (!uid)
      return res.json(Alert({ status: false, msg: "not_allowed" }, `i`));

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    if (!fs.existsSync(global.dirUpload)) {
      fs.mkdirSync(global.dirUpload);
    }

    let FileUpload = req.files.video;
    FileUpload.name = Buffer.from(FileUpload.name, "latin1").toString("utf8");

    if (FileUpload.size > global.limitUpload) {
      return res.status(413).end();
    }
    let data = {
      uid,
      slug: await Generate.FileSlug(),
    };

    const ext = mime.extension(FileUpload.mimetype);

    let uploadPath = path.join(global.dirUpload, `${data.slug}.${ext}`);

    FileUpload.mv(uploadPath, async function (err) {
      let videoData = await Get_Video_Data(uploadPath);
      let { width, height, duration } = videoData?.streams[0];

      // move to backup server
      data.title = FileUpload.name;
      data.source = `${data.slug}.${ext}`;
      data.type = `upload`;
      data.duration = duration.toFixed(0) || 0;
      data.size = FileUpload?.size;

      //created data
      let db_create = await Files.Lists.create(data);

      if (db_create?.id) {
        // upload disk_used user

        // check backup server
        let sv_backup = await GetOne.Backup();
        let sv_storage = await GetOne.Storage();
        if (sv_backup != undefined) {
          SCP.Backup({
            file: uploadPath,
            save: data.source,
            row: db_create,
            dir: "/home/public",
            sv_backup: sv_backup,
            videoInfo: {
              mimeType: FileUpload?.mimetype,
              mimeSize: `${width}x${height}`,
              fileSize: FileUpload?.size,
            },
          });
        } else if (sv_storage != undefined) {
          SCP.Storage({
            file: uploadPath,
            save: `file_default.${ext}`,
            row: db_create,
            dir: `/home/public/${data.slug}`,
            sv_storage: sv_storage,
          });
        } else {
          console.log("uploaded");
        }

        return res.json(
          Alert({ status: true, msg: `uploaded`, slug: data.slug }, `s`)
        );
      } else {
        return res.json(Alert({ status: false, msg: `db_err` }, `d`));
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(403).json({ status: false });
  }
};
