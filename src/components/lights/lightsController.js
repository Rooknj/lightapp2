import { PubSub } from "graphql-subscriptions";
import events from "events";

import LightRedisDAL from "./lightRedisDAL";
import LightMqttDAL from "./lightMqttDAL";
import Debug from "debug";

const debug = Debug("lightController");

const lightRedisDAL = new LightRedisDAL();
const mqttDAL = new LightMqttDAL();
const eventEmitter = new events.EventEmitter();
const pubsub = new PubSub();

// MQTT: payloads by default
const LIGHT_CONNECTED = 2;
const LIGHT_DISCONNECTED = 0;

// Utility functions
const mapConnectionMessageToConnectionPayload = connectionMessage => {
  let connectionString = -1;
  if (Number(connectionMessage) === LIGHT_DISCONNECTED) {
    connectionString = LIGHT_DISCONNECTED;
  } else if (Number(connectionMessage) === LIGHT_CONNECTED) {
    connectionString = LIGHT_CONNECTED;
  }
  return connectionString;
};

class LightConnector {
  constructor() {
    // Our mutation number to match each mutation to it's response
    // TODO: Store this in redis
    this.mutationNumber = 0;
    // Start the initialize function
    this.init();
  }

  async init() {
    // Set up onConnect callback
    mqttDAL.onConnect(async () => {
      debug(`Connected to MQTT broker`);
      const lights = await lightRedisDAL.getAllLights();
      lights.forEach(light => mqttDAL.subscribeToLight(light.id));
    });

    // This gets triggered when the connection of the light changes
    const handleConnectedMessage = async message => {
      // If the connectionPayload isn't correct, return
      const connectionPayload = mapConnectionMessageToConnectionPayload(
        message.connection
      );
      if (connectionPayload === -1) {
        debug(
          `Received messsage on connected topic that was not in the correct format\nMessage: ${message}`
        );
        return;
      }

      const changedLight = await lightRedisDAL.setLight(message.name, {
        connected: connectionPayload
      });
      pubsub.publish(message.name, { lightChanged: changedLight });
      pubsub.publish("lightsChanged", { lightsChanged: changedLight });
    };

    // This gets triggered when the state of the light changes
    const handleStateMessage = async message => {
      // TODO: add data checking
      const { mutationId, state, brightness, color, effect, speed } = message;
      let newState = {};
      if (state) newState = { ...newState, state };
      if (brightness) newState = { ...newState, brightness };
      if (color) newState = { ...newState, color };
      if (effect) newState = { ...newState, effect };
      if (speed) newState = { ...newState, speed };

      const changedLight = await lightRedisDAL.setLight(message.name, newState);
      pubsub.publish(message.name, { lightChanged: changedLight });
      pubsub.publish("lightsChanged", { lightsChanged: changedLight });
      // Publish to the mutation response event
      eventEmitter.emit("mutationResponse", mutationId, changedLight);
    };

    // This gets triggered when the light sends its effect list
    const handleEffectListMessage = async message => {
      const changedLight = await lightRedisDAL.setLight(message.name, {
        supportedEffects: message.effectList
      });
      pubsub.publish(message.name, { lightChanged: changedLight });
      pubsub.publish("lightsChanged", { lightsChanged: changedLight });
    };

    mqttDAL.onConnectionMessage(handleConnectedMessage);
    mqttDAL.onStateMessage(handleStateMessage);
    mqttDAL.onEffectListMessage(handleEffectListMessage);
  }

  // TODO Add an error message if no light was found
  async getLight(lightId) {
    try {
      const light = await lightRedisDAL.getLight(lightId);
      return light;
    } catch (error) {
      return error;
    }
  }

  // This gets triggered if you call setLight
  // TODO: Add error handling here
  setLight(light) {
    const { id, state, brightness, color, effect, speed } = light;

    // Initialize the MQTT payload with it's unique mutationId and the id of the light to change
    let payload = { mutationId: this.mutationNumber++, name: id };
    if (state) payload = { ...payload, state };
    if (brightness) payload = { ...payload, brightness };
    if (color) payload = { ...payload, color };
    if (effect) payload = { ...payload, effect };
    if (speed) payload = { ...payload, speed };

    // Return a promise which resolves when the light responds to this message
    return new Promise((resolve, reject) => {
      const handleMutationResponse = (mutationId, changedLight) => {
        // If the mutationId on the light's response matches the mutationId we sent on this mutation
        if (mutationId === payload.mutationId) {
          // Remove this mutation's event listener
          eventEmitter.removeListener(
            "mutationResponse",
            handleMutationResponse
          );

          // Resolve with the light's response data
          resolve(changedLight);
        }
      };

      // Every time we get a new message from the light, check to see if it has the same mutationId
      eventEmitter.on("mutationResponse", handleMutationResponse);

      // Publish to the light
      mqttDAL.publishToLight(id, payload);

      // If the response takes too long, error outs
      setTimeout(() => {
        eventEmitter.removeListener("mutationResponse", handleMutationResponse);
        reject(`Response from ${id} took too long to reach the server`);
      }, 3000);
    });
  }

  async addLight(lightId) {
    let lightAdded;
    // TODO: implmement hasLight
    // if (await lightRedisDAL.hasLight(lightId)) {
    //   ChalkConsole.error(`Error adding ${lightId}: Light already exists`);
    //   // TODO: return actual graphql error message
    //   return;
    // }

    // Add new light to light database
    try {
      lightAdded = await lightRedisDAL.addLight(lightId);
    } catch (error) {
      debug("Error adding light");
      return error;
    }
    // Subscribe to new messages from the new light
    try {
      await mqttDAL.subscribeToLight(lightId);
    } catch (error) {
      return error;
    }

    // TODO: Find a way to check if the light is connected
    // If it is connected, return then.
    // Wait a max of .5 seconds?
    pubsub.publish("lightAdded", { lightAdded });
    return lightAdded;
  }

  async removeLight(lightId) {
    let lightRemoved;
    // TODO: implmement hasLight
    // if (!await lightRedisDAL.hasLight(lightId)) {
    //   ChalkConsole.error(`Error removing ${lightId}: Light does not exist`);
    //   // TODO: return actual graphql error message
    //   return;
    // }

    // unsubscribe from the light's messages
    try {
      await mqttDAL.unsubscribeFromLight(lightId);
    } catch (error) {
      debug("Error unsubscribing light");
      return error;
    }

    // Remove light from database
    try {
      lightRemoved = await lightRedisDAL.removeLight(lightId);
    } catch (error) {
      debug("Error removing light from db");
      return error;
    }

    // Return the removed light
    pubsub.publish("lightRemoved", { lightRemoved });
    return lightRemoved;
  }

  // Subscribe to one specific light's changes
  subscribeLight(lightId) {
    return pubsub.asyncIterator(lightId);
  }

  // Subscribe to all light's changes
  subscribeAllLights() {
    return pubsub.asyncIterator("lightsChanged");
  }

  subscribeLightAdded() {
    return pubsub.asyncIterator("lightAdded");
  }

  subscribeLightRemoved() {
    return pubsub.asyncIterator("lightRemoved");
  }

  async getLights() {
    let allLights;
    try {
      allLights = await lightRedisDAL.getAllLights();
    } catch (error) {
      debug("Error getting all lights");
      return error;
    }
    return allLights;
  }
}

export default LightConnector;
