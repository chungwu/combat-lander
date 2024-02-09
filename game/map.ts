import { WORLD_HEIGHT as DEFAULT_WORLD_HEIGHT, WORLD_WIDTH as DEFAULT_WORLD_WIDTH, GRAVITY } from "./constants";
import max from "lodash/max";
import min from "lodash/min";

export class Moon {
  constructor(
    public worldWidth: number,
    public worldHeight: number,
    public vertices: number[],
    public gravity: number,
  ) {}
}

export function generateRandomMap(opts?: {
  worldWidth?: number;
  worldHeight?: number;
}) {
  const worldWidth = opts?.worldWidth ?? DEFAULT_WORLD_WIDTH;
  const worldHeight = opts?.worldHeight ?? DEFAULT_WORLD_HEIGHT;
  const vertices = generateRandom({
    width: worldWidth
  });

  return new Moon(worldWidth, worldHeight, vertices, GRAVITY);
}

function generateRandom(opts?: {
  width?: number, low?: number, high?: number, iterations?: number, H?: number
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
  
  const vertices: number[] = [];
  const segmentWidth = width / heightMap.length;
  for (let i=0; i<heightMap.length; i++) {
    vertices.push(i * segmentWidth, heightMap[i]);
  }
  // Add final vertex to bring connect the last and first point
  vertices.push(heightMap.length * segmentWidth, heightMap[0]);

  console.log("HEIGHT MAP", heightMap);
  return vertices;
}