var amqplib = require("amqplib");

// const AMQP_URL = process.env.AMQP_URL || "";
// const AMQP_PROTOCOL = process.env.AMQP_PROTOCOL;
// const AMQP_HOST = process.env.AMQP_HOST;
// const AMQP_PORT = parseInt(process.env.AMQP_PORT);
// const AMQP_USERNAME = process.env.AMQP_USERNAME;
// const AMQP_PASSWORD = process.env.AMQP_PASSWORD;
// const AMQP_VHOST = process.env.AMQP_VHOST;
const AMQP_URL = process.env.AMQP_URL || "";
const AMQP_PROTOCOL = process.env.AMQP_PROTOCOL || "amqps";
const AMQP_HOST = process.env.AMQP_HOST || "rmq.945holding.dev";
const AMQP_PORT = parseInt(process.env.AMQP_PORT || "5671");
const AMQP_USERNAME = process.env.AMQP_USERNAME || "parcel-inter-dev";
const AMQP_PASSWORD = process.env.AMQP_PASSWORD || "Y9cKHdsNPBseq2jywcLH";
const AMQP_VHOST = process.env.AMQP_VHOST || "inter-dev";

let AMQP_CONNECTION_CONFIG = {
    protocol: AMQP_PROTOCOL,
    hostname: AMQP_HOST,
    port: AMQP_PORT,
    username: AMQP_USERNAME,
    password: AMQP_PASSWORD,
    vhost: AMQP_VHOST,
  };
  if (AMQP_URL != "") {
    AMQP_CONNECTION_CONFIG = AMQP_URL;
  }
  // Exchange/Queue config
const MY_AMQP_PREFIX = process.env.MY_AMQP_PREFIX || "parcel";

const MY_EXCHANGE_PREPARE_BOOKING = MY_AMQP_PREFIX + ".exchange.prepare-booking";
const MY_EXCHANGE_CHECK_QUICKQUICK = MY_AMQP_PREFIX + ".exchange.check-quickquick";
const MY_EXCHANGE_PICK_TRACKING = MY_AMQP_PREFIX + ".exchange.picking-tracking";

module.exports = async function() {
  return amqplib.connect(AMQP_CONNECTION_CONFIG,{ rejectUnauthorized: false })
  .then(conn => conn.createChannel())
  .then(async (channel) => {
    await channel.prefetch(1);
    await channel.assertExchange(MY_EXCHANGE_PREPARE_BOOKING, "fanout", { durable: true });
    await channel.assertExchange(MY_EXCHANGE_CHECK_QUICKQUICK, "fanout", { durable: true });
    await channel.assertExchange(MY_EXCHANGE_PICK_TRACKING, "fanout", { durable: true });
    return channel;
  });
}