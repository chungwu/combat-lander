export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 1000;
export const GRAVITY = -40;


// Lander mechanics
export const LANDER_RADIUS = 10;
export const TURN_RATE = 0.8; // rad/s
export const THROTTLE_RATE = 1; // rad/s
export const FULL_THROTTLE_FORCE = 40000;
export const LANDER_COLORS = [
  // from https://www.radix-ui.com/colors level 9
  "#EC5A72", // ruby
  "#EE518A", // crimson
  "#DE51A8", // pink
  "#B658C4", // plum
  "#9A5CD0", // purple
  "#7D66D9", // violet
  "#6E6ADE", // iris
  "#5472E4", // indigo
  "#3B9EFF", // blue
  "#23AFD0", // cyan
  "#0EB39E", // teal
  "#27B08B", // jade
  "#33B074", // green
  "#53B365", // grass
  "#AE8C7E", // bronze
  "#FF801F", // orange
  "#FFD60A", // amber
  "#FFFF57", // yellow
  "#D4FF70", // lime
  "#A8F5E5", // mint
  "#A8EEFF", // sky
]

// Rocket mechanics
export const ROCKET_IMPULSE = 15000;


// Sync mechanics
export const PARTIAL_SYNC_FREQ = 60; // once per second
export const SERVER_SNAPSHOT_GC_FREQ = 60 * 30; // every 30 seconds
export const SERVER_SNAPSHOT_FREQ = 10; // save snapshot every 10 steps

export const CLIENT_SNAPSHOT_GC_FREQ = 60 * 60; // gc every minute
export const CLIENT_SNAPSHOT_FREQ = 1; // save every snapshot