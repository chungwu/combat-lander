import { AssertionError } from "assert";

export function ensure<T>(x: T | null | undefined): T {
  if (x == null) {
    throw new Error(`Expected to be non-nil`);
  }
  return x;
}
