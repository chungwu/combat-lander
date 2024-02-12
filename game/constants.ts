import { amberDark, blueDark, bronzeDark, crimsonDark, cyanDark, grassDark, greenDark, indigoDark, irisDark, jadeDark, limeDark, mintDark, orangeDark, pinkDark, plumDark, purpleDark, rubyDark, skyDark, tealDark, violetDark, yellowDark } from "@radix-ui/colors"

// Game mechanics
export const RESET_GAME_WAIT = 5 // 5 seconds 

// Map mechanics
export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 1000;
export const GRAVITY = -40;


// Lander mechanics
export const LANDER_RADIUS = 10;
export const TURN_RATE = 1; // rad/s
export const THROTTLE_RATE = 1; // rad/s
export const FULL_THROTTLE_FORCE = 40000;

export const LANDER_COLORS_MAP = {
  "ruby": rubyDark,
  "crimson": crimsonDark,
  "pink": pinkDark,
  "plum": plumDark,
  "purple": purpleDark,
  "violet": violetDark,
  "iris": irisDark,
  "indigo": indigoDark,
  "blue": blueDark,
  "cyan": cyanDark,
  "teal": tealDark,
  "jade": jadeDark,
  "green": greenDark,
  "grass": grassDark,
  "bronze": bronzeDark,
  "orange": orangeDark,
  "amber": amberDark,
  "yellow": yellowDark,
  "lime": limeDark,
  "mint": mintDark,
  "sky": skyDark,
} as const;

export const LANDER_COLORS = Object.keys(LANDER_COLORS_MAP) as (keyof typeof LANDER_COLORS_MAP)[];

export type LanderColor = keyof typeof LANDER_COLORS_MAP;

export function getLanderColor(color: LanderColor, level: 1|2|3|4|5|6|7|8|9|10|11|12) {
  const colors = LANDER_COLORS_MAP[color] as any;
  return colors[`${color}${level}`] as string;
}

// Rocket mechanics
export const ROCKET_IMPULSE = 15000;


// Sync mechanics
export const PARTIAL_SYNC_FREQ = 60; // once per second
export const SERVER_SNAPSHOT_GC_FREQ = 60 * 30; // every 30 seconds
export const SERVER_SNAPSHOT_FREQ = 10; // save snapshot every 10 steps

export const CLIENT_SNAPSHOT_GC_FREQ = 60 * 60; // gc every minute
export const CLIENT_SNAPSHOT_FREQ = 1; // save every snapshot