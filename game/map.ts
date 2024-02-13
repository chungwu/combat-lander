import { WORLD_HEIGHT as DEFAULT_WORLD_HEIGHT, WORLD_WIDTH as DEFAULT_WORLD_WIDTH, GRAVITY, LANDING_PAD_STATS, LandingPadType } from "./constants";
import max from "lodash/max";
import min from "lodash/min";
import pull from "lodash/pull";

export class Moon {
  constructor(
    public worldWidth: number,
    public worldHeight: number,
    public vertices: [number, number][],
    public gravity: number,
    public landingPads: {index: number, type: LandingPadType}[]
  ) {}
}

export function generateRandomMap(opts?: {
  worldWidth?: number;
  worldHeight?: number;
  numShortLandingPads?: number;
  numLongLandingPads?: number;
}) {
  const worldWidth = opts?.worldWidth ?? DEFAULT_WORLD_WIDTH;
  const worldHeight = opts?.worldHeight ?? DEFAULT_WORLD_HEIGHT;
  const vertices = generateRandom({
    width: worldWidth
  });

  const {
    vertices: verticesWithPads,
    landingPads
  } = addLandingPads(vertices, {
    worldWidth, numShortLandingPads: opts?.numShortLandingPads ?? 1,
    numLongLandingPads: opts?.numLongLandingPads ?? 1
  });

  return new Moon(worldWidth, worldHeight, verticesWithPads, GRAVITY, landingPads);
}

function addLandingPads(vertices: [number, number][], opts: {
  worldWidth: number;
  numShortLandingPads: number;
  numLongLandingPads: number;
}) {
  const newVertices = [...vertices];
  const landingPads: {index: number, type: LandingPadType}[] = [];

  const makeLandingPad = (type: "long" | "short") => {
    const padWidth = LANDING_PAD_STATS[type].width;
    const pickStart = () => {
      while (true) {
        const start = Math.floor(Math.random() * opts.worldWidth);
        const end = start + padWidth;
        if (
          start > 0 &&
          end < opts.worldWidth && 
          landingPads.every(pad => {
            const padStart = newVertices[pad.index][0];
            const padEnd = newVertices[pad.index + 1][0];
            return (
              padEnd < start || padStart > end
            );
          })
        ) {
          return start;
        }
      }
    };

    const start = pickStart();
    const end = start + padWidth;
    const index = newVertices.findIndex(v => v[0] > start);
    const height = newVertices[index][1];
    const toRemove = newVertices.filter((v, i) => v[0] >= start && v[0] <= end);
    pull(newVertices, ...toRemove);
    newVertices.splice(index, 0, [start, height], [end, height]);
    for (const pad of landingPads) {
      if (pad.index >= index) {
        pad.index = pad.index + 2 - toRemove.length;
      }
    }
    landingPads.push({index, type});
  };

  for (let i=0; i<opts.numShortLandingPads; i++) {
    makeLandingPad("short");
  }

  for (let i=0; i<opts.numLongLandingPads; i++) {
    makeLandingPad("long");
  }

  return { vertices: newVertices, landingPads };
}

function generateRandom(opts?: {
  width?: number, 
  low?: number, 
  high?: number, 
  iterations?: number, 
  H?: number
}) {
  const width = opts?.width ?? DEFAULT_WORLD_WIDTH;
  const low = opts?.low ?? 10;
  const high = opts?.high ?? width * 0.4;
  const H = 0.5;
  const iterations = opts?.iterations ?? 8;

  const heightMap: number[] = new Array(1 << iterations).fill(0);
  let range = 1000.0;

  for (let i = 0; i < iterations; i++) {
    range *= H;
    const stepSize = (1 << iterations) / (1 << i);
    for (let j = 0; j < heightMap.length; j += stepSize) {
      heightMap[j + stepSize / 2] = (
        heightMap[j] + heightMap[(j + stepSize)% heightMap.length]
      ) / 2;
      heightMap[j + stepSize / 2] += (Math.random() - 0.5) / 0.5 * range;
    }
  }
  
  const curMax = max(heightMap)!;
  const curLow = min(heightMap)!;
  for (let i=0; i<heightMap.length; i++) {
    const cur = heightMap[i];
    const normalized = ((cur - curLow) / (curMax - curLow)) * high + low;
    heightMap[i] = normalized;
  }
  
  const vertices: [number, number][] = [];
  const segmentWidth = width / heightMap.length;
  for (let i=0; i<heightMap.length; i++) {
    vertices.push([i * segmentWidth, heightMap[i]]);
  }
  // Add final vertex to bring connect the last and first point
  vertices.push([heightMap.length * segmentWidth, heightMap[0]]);
  return vertices;
}