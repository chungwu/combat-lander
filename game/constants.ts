import { degreesToRadians } from "@/utils/math";
import { amberDark, blueDark, bronzeDark, crimsonDark, cyanDark, grassDark, greenDark, indigoDark, irisDark, jadeDark, limeDark, mintDark, orangeDark, pinkDark, plumDark, purpleDark, rubyDark, skyDark, tealDark, violetDark, yellowDark } from "@radix-ui/colors"

// Game mechanics
export const RESET_GAME_WAIT = 5 // 5 seconds 
export const WON_GAME_WAIT = 5 // 10 seconds 

// Map mechanics
export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 1000;
export const GRAVITY = -40;

export type LandingPadType = "long" | "short";
export const LANDING_PAD_STATS = {
  "long": {
    multiplier: 2,
    width: 60,
  }, 
  "short": {
    multiplier: 4,
    width: 30,
  }
} as const;


// Lander mechanics
export const LANDER_RADIUS = 10;
export const TURN_RATE = 1; // rad/s
export const THROTTLE_RATE = 2;
export const FULL_THROTTLE_FORCE = 50000;
export const THROTTLE_FUEL_BURN_RATE = 3;
export const ROTATE_FUEL_BURN_RATE = 1;

export const LANDING_INDICATOR_THRESHOLD = 150;
export const LANDING_SAFE_ROTATION = degreesToRadians(5); // 5 degrees
export const LANDING_SAFE_VX = 10;
export const LANDING_SAFE_VY = 20;

export const ROCKET_STATS = {
  "small": {
    radius: 10,
    initialVelocity: 40,
    aliveSteps: 60 * 30, // alive for 30s,
    ammo: 5,
    replenishSteps: 60 * 3, // 3 seconds to replenish a rocket
    impulse: 15000,
  },
  "big": {
    radius: 25,
    initialVelocity: 40,
    aliveSteps: 60 * 30,
    ammo: 1,
    replenishSteps: 60 * 10,
    impulse: 50000,
  } as const
};

export type RocketType = keyof typeof ROCKET_STATS;

export const CONTACT_DAMAGE_FACTOR = {
  "ground": 3,
  "sky": 0,
  "rocket": 0.5,
  "lander": 1
} as const;

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

// Sync mechanics
export const PARTIAL_SYNC_FREQ = 60; // once per second
export const SERVER_SNAPSHOT_GC_FREQ = 60 * 10; // every 10 seconds
export const SERVER_SNAPSHOT_FREQ = 1; // save every snapshot

export const CLIENT_SNAPSHOT_GC_FREQ = 60 * 1; // gc every second
export const CLIENT_SNAPSHOT_FREQ = 1; // save every snapshot

export const JOYSTICK_CONFIG: {use: boolean, scheme: "keyboard" | "angled" | "mixed", threshold: number} = {
  use: false,
  scheme: "angled",
  threshold: 0.1
};
