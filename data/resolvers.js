import { FortuneCookie } from "./connectors";

//example data
const lights = [
  { id: 1, name: "Light 1", power: true, brightness: 100, hue: 23, saturation: 51 },
  { id: 2, name: "Light 2", power: false, brightness: 100, hue: 23, saturation: 51 },
  { id: 3, name: "Light 3", power: true, brightness: 50, hue: 23, saturation: 51 },
  { id: 4, name: "Light 4", power: true, brightness: 100, hue: 255, saturation: 51 },
  { id: 5, name: "Light 5", power: true, brightness: 100, hue: 23, saturation: 0 },
]

const resolvers = {
  Query: {
    getFortuneCookie: () =>  FortuneCookie.getOne(),
    light: (_, { lightId }) => lights[lightId],
    lights: () => lights
  },
  Mutation: {
    setName: (_, {lightId, name}) => {
      //Find the light in the array of lights
      let light = lights.find( ({ id }) => id === lightId );
      //if the light wasnt found
      if (!light) {
        throw new Error(`Couldn't find light with id ${lightId}`);
      }
      //replace old light with new light
      light = Object.assign(light, {name});
      return light;
    },
    setPower: (_, {lightId, power}) => {
      //Find the light in the array of lights
      let light = lights.find( ({ id }) => id === lightId );
      //if the light wasnt found
      if (!light) {
        throw new Error(`Couldn't find light with id ${lightId}`);
      }
      //replace old light with new light
      light = Object.assign(light, {power});
      return light;
    },
    setBrightness: (_, {lightId, brightness}) => {
      //Find the light in the array of lights
      let light = lights.find( ({ id }) => id === lightId );
      //if the light wasnt found
      if (!light) {
        throw new Error(`Couldn't find light with id ${lightId}`);
      }
      //replace old light with new light
      light = Object.assign(light, {brightness});
      return light;
    },
    setHue: (_, {lightId, hue}) => {
      //Find the light in the array of lights
      let light = lights.find( ({ id }) => id === lightId );
      //if the light wasnt found
      if (!light) {
        throw new Error(`Couldn't find light with id ${lightId}`);
      }
      //replace old light with new light
      light = Object.assign(light, {hue});
      return light;
    },
    setSaturation: (_, {lightId, saturation}) => {
      //Find the light in the array of lights
      let light = lights.find( ({ id }) => id === lightId );
      //if the light wasnt found
      if (!light) {
        throw new Error(`Couldn't find light with id ${lightId}`);
      }
      //replace old light with new light
      light = Object.assign(light, {saturation});
      return light;
    },
    addLight: (_, {newLight}) => {
      lights.push(newLight);
      return lights.find( ({ id }) => id === newLight.id );
    }
  }
};

export default resolvers;
