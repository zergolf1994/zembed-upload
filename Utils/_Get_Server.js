"use strict";
const { Storages } = require(`../Models`);
const { Op } = require("sequelize");

exports.Storage = async () => {
  try {
    let rows = await Storages.Lists.findOne({
      where: {
        active: 1,
      },
      attributes: ["id", "sv_ip", "disk_percent"],
      include: [
        {
          required: true,
          model: Storages.Sets,
          as: "sets",
          attributes: ["name", "value"],
          where: {
            name: { [Op.or]: ["username", "password"] },
            value: { [Op.ne]: "" },
          },
        },
      ],
      order: [["disk_percent", "ASC"]],
    });

    if (!rows) return;

    let data = {};
    data.id = rows?.id;
    data.sv_ip = rows?.sv_ip;
    let sets = rows?.sets;
    if (!sets.length) return;
    for (let key in sets) {
      if (sets.hasOwnProperty(key)) {
        let name = sets[key]?.dataValues?.name;
        let value = sets[key]?.dataValues?.value;
        data[name] = value;
      }
    }
    return data;
  } catch (error) {
    console.log("get storage", error);
    return;
  }
};
