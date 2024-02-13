import { World } from "@dimforge/rapier2d";
import { addExtension, Packr } from "msgpackr";
import { Moon } from "./map";

export const PACKR = new Packr();
addExtension({
  Class: World,
  type: 11,
  pack(instance: World) {
    return instance.takeSnapshot();
  },
  unpack(buffer) {
    return World.restoreSnapshot(buffer);
  }
});

addExtension({
  Class: Moon,
  type: 12,
  write(moon: Moon) {
    return {
      worldWidth: moon.worldWidth,
      worldHeight: moon.worldHeight,
      vertices: moon.vertices,
      gravity: moon.gravity,
      landingPads: moon.landingPads,
    }
  },
  read(data) {
    return new Moon(
      data.worldWidth,
      data.worldHeight,
      data.vertices,
      data.gravity,
      data.landingPads,
    );
  }
});