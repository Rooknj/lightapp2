const { toConnectionString } = require("./lightUtil");
const Debug = require("debug").default;
const debug = Debug("repo");

const ALL_LIGHTS_SUBSCRIPTION_TOPIC = "lightsChanged";
const LIGHT_ADDED_SUBSCRIPTION_TOPIC = "lightAdded";
const LIGHT_REMOVED_SUBSCRIPTION_TOPIC = "lightRemoved";

// TODO: Add this variable to redis
let mutationNumber = 0;

// TODO: Find a better way to do this
const events = require("events");
const { promisify } = require("util");
const TIMEOUT_WAIT = 5000;
const asyncSetTimeout = promisify(setTimeout);
const eventEmitter = new events.EventEmitter();

module.exports = ({ db, pubsub, gqlPubSub }) => {
  let self = {};

  /**
   * Attempts to subscribe to all added lights
   * Sets the self.connected property to true if successful
   */
  const connect = async () => {
    if (!pubsub.connected) {
      debug("Cant connect repo, pubsub not connected");
      return new Error("pubsub not connected");
    }
    if (!db.connected) {
      debug("Cant connect repo, db not connected");
      return new Error("db not connected");
    }
    if (self.connected) {
      debug("Repository already connected");
      return null;
    }

    // Get the saved lights from redis
    const { error, lights } = await db.getAllLights();
    if (error) {
      debug(`Error getting all lights during subscribeToAllLights ${error}`);
      return error;
    }

    // TODO: If you failed to subscribe to a light, find a way to resubscribe
    // Subscribe to all lights and put their responses into an array
    const subscriptionPromises = lights.map(light =>
      pubsub.subscribeToLight(light.id)
    );

    // Wait for all subscriptions to resolve then check for errors
    const errors = await Promise.all(subscriptionPromises);
    let subscriptionError = null;
    errors.forEach(error => {
      if (subscriptionError) return;
      if (error) {
        debug(error);
        subscriptionError = error;
      }
    });

    if (subscriptionError) return subscriptionError;
    // Set connection status to true if there were no errors
    self.connected = true;
    return null;
  };

  /**
   * Updates the db with the connect message data and notifies subscribers.
   * Will ignore messages not in the correct format.
   * @param {object} message - the connect status message of a light
   */
  const handleConnectMessage = async message => {
    // Convert the message to a database string
    const connectionString = toConnectionString(message.connection);
    if (connectionString === -1) {
      debug(`Incorrect connection format: ignoring\nMessage: ${message}`);
      return;
    }

    let error, changedLight;

    // Update the light's connection data in the db
    error = await db.setLight(message.name, {
      connected: connectionString
    });
    if (error) {
      debug(error);
      return;
    }

    ({ error, light: changedLight } = await db.getLight(message.name));
    if (error) {
      debug(error);
      return;
    }

    // Notify subscribers of the change in connection status
    gqlPubSub.publish(message.name, { lightChanged: changedLight });
    gqlPubSub.publish("lightsChanged", {
      lightsChanged: changedLight
    });
  };

  /**
   * Updates the db with the state message data and notifies subscribers.
   * Will also notify setLight that the light sent a response.
   * @param {object} message - the state message of a light
   */
  const handleStateMessage = async message => {
    // Parse the message and generate a newState object
    // TODO: add data checking
    const { mutationId, state, brightness, color, effect, speed } = message;
    let newState = {};
    if (state) newState = { ...newState, state };
    if (brightness) newState = { ...newState, brightness };
    if (color) newState = { ...newState, color };
    if (effect) newState = { ...newState, effect };
    if (speed) newState = { ...newState, speed };

    let error, changedLight;
    // Update the light's state data in the db
    error = await db.setLight(message.name, newState);
    if (error) {
      debug(error);
      return;
    }

    ({ error, light: changedLight } = await db.getLight(message.name));
    if (error) {
      debug(error);
      return;
    }
    // Notify subscribers of change in state
    gqlPubSub.publish(message.name, { lightChanged: changedLight });
    gqlPubSub.publish("lightsChanged", {
      lightsChanged: changedLight
    });

    // Notify setLight of the light's response
    eventEmitter.emit("mutationResponse", mutationId, changedLight);
  };

  /**
   *
   * @param {object} message - the effect list message of a light
   */
  const handleEffectListMessage = async message => {
    let error, changedLight;

    // Update the light's effect list in the db
    error = await db.setLight(message.name, {
      supportedEffects: message.effectList
    });
    if (error) {
      debug(error);
      return;
    }

    ({ error, light: changedLight } = db.getLight(message.name));
    if (error) {
      debug(error);
      return;
    }

    // Notify subscribers of the change in the effect list
    gqlPubSub.publish(message.name, { lightChanged: changedLight });
    gqlPubSub.publish("lightsChanged", {
      lightsChanged: changedLight
    });
  };

  /**
   * Get the light with the specified id from the db.
   * Will return an error of the light was not added.
   * @param {string} lightId
   */
  const getLight = async lightId => {
    let error, hasLight, light;

    // If the light was never added, return an error
    ({ error, hasLight } = await db.hasLight(lightId));
    if (error) return error;
    if (!hasLight) return new Error(`"${lightId}" is not currently added`);

    // Get the light and return the data
    ({ error, light } = await db.getLight(lightId));
    return error ? error : light;
  };

  /**
   * Get all lights currently added to the db.
   */
  const getLights = async () => {
    const { error, lights } = await db.getAllLights();
    return error ? error : lights;
  };

  /**
   * Add the light to the db and subscribe to it's changes.
   * Will return an error if the light was already added.
   * @param {string} lightId
   */
  const addLight = async lightId => {
    let error, hasLight;

    // If the light was already added, return an error
    ({ error, hasLight } = await db.hasLight(lightId));
    if (error) return error;
    if (hasLight)
      return new Error(`The light with id (${lightId}) was already added`);

    // Add new light to light database
    error = await db.addLight(lightId);
    if (error) return error;

    // Subscribe to new messages from the new light
    // TODO: put light in a queue to resubscribe when MQTT is connected
    error = await pubsub.subscribeToLight(lightId);
    if (error) debug(`Failed to subscribe to ${lightId}\n${error}`);

    // Get the newly added light, notify subscribers, and return it
    const lightAdded = await getLight(lightId);
    gqlPubSub.publish("lightAdded", { lightAdded });
    return lightAdded;
  };

  /**
   * Remove the light with the specified id from the db and unsubscribe from it's changes.
   * Will return an error if the light is not currently added.
   * Only returns an object containing the light's id.
   * @param {string} lightId
   */
  const removeLight = async lightId => {
    let error, hasLight;

    // Check if the light exists already before doing anything else
    ({ error, hasLight } = await db.hasLight(lightId));
    if (error) return error;
    if (!hasLight) return new Error(`"${lightId}" is not currently added`);

    // Unsubscribe from the light's messages
    error = await pubsub.unsubscribeFromLight(lightId);
    if (error) {
      debug(`Could not unsubscribe from ${lightId}`);
      return new Error(`Could not unsubscribe from ${lightId}`);
    }

    // TODO: Add cleanup here in case we only remove part of the light from redis
    // TODO: Figure out if we should resubscribe to the light if it wasn't completely removed
    // Remove light from database
    error = await db.removeLight(lightId);
    if (error) return error;

    const lightRemoved = { id: lightId };
    // Return the removed light and notify the subscribers
    gqlPubSub.publish("lightRemoved", { lightRemoved });
    return lightRemoved;
  };

  /**
   * Sends a message to the specified light with a list of state changes.
   * @param {Object} light
   */
  const setLight = async light => {
    // Check if the light exists already before doing anything else
    const { error, hasLight } = await db.hasLight(light.id);
    if (error) return error;
    if (!hasLight) return new Error(`"${light.id}" was never added`);

    // Create the command payload
    const { id, state, brightness, color, effect, speed } = light;
    let payload = { mutationId: mutationNumber++, name: id };
    if (state) payload = { ...payload, state };
    if (brightness) payload = { ...payload, brightness };
    if (color) payload = { ...payload, color };
    if (effect) payload = { ...payload, effect };
    if (speed) payload = { ...payload, speed };

    // Return a promise which resolves when the light responds to this message or rejects if it takes too long
    return new Promise(async (resolve, reject) => {
      const handleMutationResponse = (mutationId, changedLight) => {
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
      const error = await pubsub.publishToLight(id, payload);
      if (error) reject(error);

      // if the response takes too long, error out
      await asyncSetTimeout(TIMEOUT_WAIT);
      eventEmitter.removeListener("mutationResponse", handleMutationResponse);
      reject(new Error(`Response from ${id} timed out`));
    });
  };

  /**
   * Subscribes to the changes of a specific light.
   * @param {string} lightId
   */
  const subscribeToLight = lightId => gqlPubSub.asyncIterator(lightId);

  /**
   * Subscribes to the changes of all lights.
   */
  const subscribeToAllLights = () =>
    gqlPubSub.asyncIterator(ALL_LIGHTS_SUBSCRIPTION_TOPIC);

  /**
   * Subscribes to lights being added.
   */
  const subscribeToLightsAdded = () =>
    gqlPubSub.asyncIterator(LIGHT_ADDED_SUBSCRIPTION_TOPIC);

  /**
   * Subscribes to lights being removed.
   */
  const subscribeToLightsRemoved = () =>
    gqlPubSub.asyncIterator(LIGHT_REMOVED_SUBSCRIPTION_TOPIC);

  self = {
    connected: false,
    connect,
    handleConnectMessage,
    handleStateMessage,
    handleEffectListMessage,
    getLight,
    getLights,
    setLight,
    addLight,
    removeLight,
    subscribeToLight,
    subscribeToAllLights,
    subscribeToLightsAdded,
    subscribeToLightsRemoved
  };

  // Start listening to the messages
  pubsub.connectMessages.subscribe(self.handleConnectMessage);
  pubsub.stateMessages.subscribe(self.handleStateMessage);
  pubsub.effectMessages.subscribe(self.handleEffectListMessage);

  // Subscribe to all lights on startup
  db.connections.subscribe(self.connect);
  pubsub.connections.subscribe(self.connect);
  pubsub.disconnections.subscribe(() => (self.connected = false));
  db.disconnections.subscribe(() => (self.connected = false));

  return Object.create(self);
};
