const axios = require("axios");
const constants = require("../utils/constants");
const { firebase } = require("../config/app.config")

const instanceAppcheck = axios.create({
  baseURL: firebase.apiBase.appCheck,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "*/*",
    "User-Agent": "Locket/1 CFNetwork/1498.700.2 Darwin/23.6.0",
    "X-Ios-Bundle-Identifier": constants.IOS_BUNDLE_ID,
    "X-Goog-Api-Key": firebase.apiKey,
  },
});

module.exports = { instanceAppcheck };
