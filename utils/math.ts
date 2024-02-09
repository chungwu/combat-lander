import { Vector2 } from "@dimforge/rapier2d";

export function normalizeAngle(angle: number) {
  while (angle < -Math.PI) {
    angle += 2 * Math.PI;
  }
  while (angle >= Math.PI) {
    angle -= 2 * Math.PI;
  }
  return angle;
}

export function rotateVector(vec: Vector2, angle: number) {
  const x2 = vec.x * Math.cos(angle) - vec.y * Math.sin(angle);
  const y2 = vec.x * Math.sin(angle) + vec.y * Math.cos(angle);
  return new Vector2(x2, y2);
}