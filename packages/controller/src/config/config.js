const Debug = require("debug").default;
const debug = Debug("config");

const getMqttHost = () => {
  let MQTT_BROKER = `tcp://prysma.local:1883`;
  if (process.env.MQTT_HOST) {
    debug(`Adding custom MQTT host: ${process.env.MQTT_HOST}`);
    MQTT_BROKER = `tcp://${process.env.MQTT_HOST}:1883`;
  }
  return MQTT_BROKER;
};

const getRedisHost = () => {
  let REDIS_HOST = "localhost";
  if (process.env.REDIS_HOST) {
    debug(`Adding custom Redis Host: ${process.env.REDIS_HOST}`);
    REDIS_HOST = process.env.REDIS_HOST;
  }
  return REDIS_HOST;
};

const rabbitSettings = {
  protocol: "amqp",
  hostname: process.env.RABBIT_HOST || "prysma.local",
  port: 5672,
  username: "guest",
  password: "guest",
  locale: "en_US",
  frameMax: 0,
  heartbeat: 0,
  vhost: "/"
};

const mqttSettings = {
  host: getMqttHost(),
  reconnectPeriod: 5000, // Amount of time between reconnection attempts
  username: "pi",
  password: "MQTTIsBetterThanUDP",
  MQTT_LIGHT_TOP_LEVEL: "prysmalight",
  MQTT_LIGHT_CONNECTED_TOPIC: "connected",
  MQTT_LIGHT_STATE_TOPIC: "state",
  MQTT_LIGHT_COMMAND_TOPIC: "command",
  MQTT_EFFECT_LIST_TOPIC: "effects"
};

const redisSettings = {
  host: getRedisHost(),
  port: process.env.REDIS_PORT || 6379
};

module.exports = Object.assign(
  {},
  { rabbitSettings, mqttSettings, redisSettings }
);
