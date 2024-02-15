import { customAlphabet } from "nanoid";

export function ensure<T>(x: T | null | undefined): T {
  if (x == null) {
    throw new Error(`Expected to be non-nil`);
  }
  return x;
}

export function ensureInstance<T>(x: any, cls: new (...args: any[]) => T) {
  if (x instanceof cls) {
    return x as T;
  } else {
    throw new Error(`Expected ${x} to be an instance of ${cls}`);
  }
}

export function isServer() {
  return typeof window === "undefined";
}

export type ArrayElementType<T> = T extends (infer U)[] ? U : never;

export function isTouchDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints > 0);
}

// We don't care that much about collision, so use a small,
// easy to share alphabet
export const makeShortId = customAlphabet('23456789abcdefghijkmnpqrstuvwxyz', 6);
