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

export function addVector(vec1: Vector2, vec2: Vector2) {
  return new Vector2(vec1.x + vec2.x, vec1.y + vec2.y);
}

export function scaleVector(vec: Vector2, scale: number) {
  return new Vector2(vec.x * scale, vec.y * scale);
}

export function vectorMagnitude(vector: Vector2) {
  return Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
}

export function vectorDistance(v1: Vector2, v2: Vector2) {
  return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));
}

export function radianToDegrees(rad: number) {
  return rad * (180 / Math.PI);
}

export function degreesToRadians(deg: number) {
  return deg * Math.PI / 180;
}
