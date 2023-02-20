"use strict";
const fs = require("fs-extra");
const path = require("path");
const mime = require("mime-types");
const shell = require("shelljs");
const request = require("request");

const { Files, Storages } = require(`../Models`);
const { Generate, GetServer, VideoData, getSets } = require(`../Utils`);
const { Op } = require("sequelize");
const { Client } = require("node-scp");

module.exports = async (req, res) => {
  try {
    let { uid } = req.user;

    let FileUpload = req?.files?.video;
    FileUpload.name = Buffer.from(FileUpload.name, "latin1").toString("utf8");

    if (FileUpload.size > global.limitUpload) {
      return res.status(413).end();
    }
    let data = {
      slug: await Generate.file_slug(),
    };
    const ext = mime.extension(FileUpload.mimetype);

    if (!fs.existsSync(global.dirPublic)) fs.mkdirSync(global.dirPublic);

    let uploadPath = path.join(global.dirPublic, `${data.slug}.${ext}`);
    FileUpload.mv(uploadPath, async function (err) {
      if (!uid) {
        fs.unlinkSync(uploadPath);
        return res.status(403).json({ status: false, msg: "not_allowed" });
      }

      let sv_storage = await GetServer.Storage();
      if (!sv_storage) {
        fs.unlinkSync(uploadPath);
        return res.status(403).json({ status: false, msg: "storage_busy" });
      }
      let vdo_ = await VideoData(uploadPath);
      let { width, height, duration } = vdo_?.streams[0];

      let create_data = {
        userId: uid,
        title: FileUpload.name,
        type: "upload",
        size: FileUpload?.size,
        s_video: 1,
        duration: duration.toFixed(0) || 0,
        slug: data.slug,
      };
      // remote to storage
      await RemoteToStorage({
        file: uploadPath,
        save: `file_default.${ext}`,
        dir: `/home/files/${create_data.slug}`,
        sv_storage: sv_storage,
        create_data,
      });

      return res.status(200).json({ status: true, data });
    });
  } catch (error) {
    console.log(error);
    return res.status(403).json({ status: false });
  }
};

function RemoteToStorage({ file, save, dir, sv_storage, create_data }) {
  return new Promise(async function (resolve, reject) {
    let sets = await getSets();
    let server = {
      host: sv_storage?.sv_ip,
      port: sv_storage?.port,
      username: sv_storage?.username,
      password: sv_storage?.password,
    };
    if (!create_data) {
      reject();
    }
    Client(server)
      .then(async (client) => {
        let uploadTo = save;
        if (dir) {
          const dir_exists = await client
            .exists(dir)
            .then((result) => {
              return result;
            })
            .catch((error) => {
              return false;
            });

          if (!dir_exists) {
            await client
              .mkdir(dir)
              .then((response) => {
                console.log("dir created", dir);
              })
              .catch((error) => {
                reject();
              });
          }
          uploadTo = `${dir}/${save}`;
        }

        await client
          .uploadFile(file, uploadTo)
          .then(async (response) => {
            let db_create = await Files.Lists.create(create_data);
            if (db_create?.id) {
              let file_data = {
                active: 1,
                type: "video",
                name: "default",
                value: save,
                fileId: db_create?.id,
                storageId: sv_storage?.id,
                userId: db_create?.userId,
              };
              await Files.Datas.create({ ...file_data });
              fs.unlinkSync(file);
            }
            // check disk
            request(
              { url: `http://${sv_storage?.sv_ip}/check-disk` },
              function (error, response, body) {
                console.log("cron-check", sv_storage?.sv_ip);
              }
            );

            // thumbs
            request(
              { url: `http://${sets?.domain_api_admin}/cron/thumbs` },
              function (error, response, body) {
                console.log("cron-thumbs", sets?.domain_api_admin);
              }
            );

            client.close();
            resolve(true);
          })
          .catch((error) => {
            console.log("error", error);
            client.close();
            reject();
          });
      })
      .catch((e) => {
        console.log("e", e);
        client.close();
        reject();
      });
  });
}
