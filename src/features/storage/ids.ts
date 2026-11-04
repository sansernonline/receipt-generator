import { randomUUID } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const newId = (): string => randomUUID();

export const isValidId = (id: unknown): id is string => typeof id === "string" && UUID_PATTERN.test(id);

// ids come from outside (URL, request body); check before they become part of a path
export function assertValidId(id: unknown): asserts id is string {
  if (!isValidId(id)) throw new Error("invalid id");
}
