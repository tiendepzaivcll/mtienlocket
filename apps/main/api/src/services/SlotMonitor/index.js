const routes = require("./routes");
const { startWorker, stopWorker } = require("./service");

module.exports = { routes, startWorker, stopWorker };
