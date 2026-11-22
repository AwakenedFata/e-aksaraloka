import "server-only";
import { z } from "zod";

/**
 * Server-side environment schema.
 *
 * Rules:
 * - Never import this module from client components. `server-only` enforces it at build time.
 * - Never log values. Validation errors report variable names and reasons only.
 * - Empty strings are treated as "not set" so placeholder lines in .env do not pass as values.
 *
 * Stage 0 marks provider credentials and the database as optional because no feature uses them yet.
 * Later stages tighten requirements via feature-level checks (e.g. LLM router refuses to start a
 * provider whose key is missing) instead of crashing the whole app.
 */

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z.enum(["debug", "info", "warn", "error"]).default("info"),
  ),

  MONGODB_URI: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://")
      .optional(),
  ),
  MONGODB_DB_NAME: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,63}$/, "must be 1-63 chars of letters, digits, '_' or '-'")
      .default("aksaraloka"),
  ),

  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(80).default("gemini-2.5-flash"),
  ),
  GROQ_API_KEY: optionalString,
  GROQ_MODEL: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(80).default("llama-3.3-70b-versatile"),
  ),

  APP_COMMIT_SHA: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  readonly issues: ReadonlyArray<{ variable: string; reason: string }>;

  constructor(issues: ReadonlyArray<{ variable: string; reason: string }>) {
    super(
      `Invalid server environment: ${issues
        .map((issue) => `${issue.variable} (${issue.reason})`)
        .join(", ")}`,
    );
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

/** Pure parser, exported for tests. Does not read process.env by itself. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => ({
        variable: issue.path.join(".") || "(root)",
        reason: issue.message,
      })),
    );
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Lazily validated, memoized server environment. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Test-only helper to drop the memoized value. */
export function resetServerEnvCacheForTests(): void {
  cached = undefined;
}
