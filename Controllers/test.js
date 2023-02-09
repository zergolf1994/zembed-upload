"use strict";

const { CheckDisk } = require(`../Utils`);
module.exports = async (req, res) => {
  try {
    return res.status(200).json({ status: true });
  } catch (error) {
    console.log(error);
    return res.status(403).json({ status: false });
  }
};
