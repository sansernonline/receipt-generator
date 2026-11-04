import path from "node:path";

export const DATA_DIR_ENV = "BILLGEN_DATA_DIR";

// production must set it (data outside the deploy folder, ARCH 4.1); dev falls back to a git-ignored folder
export function getDataDir(env: Record<string, string | undefined> = process.env): string {
  const configured = env[DATA_DIR_ENV]?.trim();
  if (configured) return path.resolve(configured);
  if (env.NODE_ENV === "production") throw new Error(`${DATA_DIR_ENV} must be set in production`);
  return path.resolve(process.cwd(), ".billgen-data");
}
