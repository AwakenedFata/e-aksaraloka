import "server-only";
import packageJson from "../../../package.json";
import { getServerEnv } from "./env";

/**
 * Build/version metadata. Later stages extend this with analysis engine, rule set, prompt and
 * schema versions so every stored analysis is reproducible (master prompt §29).
 */
export interface BuildInfo {
  name: string;
  version: string;
  commit: string | null;
}

export function getBuildInfo(): BuildInfo {
  return {
    name: packageJson.name,
    version: packageJson.version,
    commit: getServerEnv().APP_COMMIT_SHA ?? null,
  };
}
