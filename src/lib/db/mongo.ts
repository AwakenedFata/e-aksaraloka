import "server-only";
import { MongoClient, type Db } from "mongodb";
import { getServerEnv } from "@/lib/config/env";

/**
 * Lazy MongoDB client singleton.
 *
 * - No connection is attempted at import time; `next build` never needs a database.
 * - In development the client is cached on globalThis so hot reloads do not leak connections.
 * - Callers must handle `null` from `getMongoClient()` (database not configured).
 */

const SERVER_SELECTION_TIMEOUT_MS = 3_000;

type GlobalWithMongo = typeof globalThis & {
  __aksaralokaMongoClient?: Promise<MongoClient>;
};

const globalWithMongo = globalThis as GlobalWithMongo;

export function isDatabaseConfigured(): boolean {
  return getServerEnv().MONGODB_URI !== undefined;
}

export function getMongoClient(): Promise<MongoClient> | null {
  const { MONGODB_URI } = getServerEnv();
  if (!MONGODB_URI) return null;

  if (!globalWithMongo.__aksaralokaMongoClient) {
    const client = new MongoClient(MONGODB_URI, {
      appName: "aksaraloka",
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    });
    globalWithMongo.__aksaralokaMongoClient = client.connect().catch((error: unknown) => {
      // Drop the failed promise so the next call can retry instead of caching the failure.
      globalWithMongo.__aksaralokaMongoClient = undefined;
      throw error;
    });
  }
  return globalWithMongo.__aksaralokaMongoClient;
}

export async function getDb(): Promise<Db | null> {
  const clientPromise = getMongoClient();
  if (!clientPromise) return null;
  const client = await clientPromise;
  return client.db(getServerEnv().MONGODB_DB_NAME);
}

export type DatabasePingResult =
  | { status: "ok"; latencyMs: number }
  | { status: "not_configured" }
  | { status: "error"; latencyMs: number; errorName: string };

/** Readiness probe. Never returns connection strings or raw driver messages. */
export async function pingDatabase(): Promise<DatabasePingResult> {
  if (!isDatabaseConfigured()) return { status: "not_configured" };
  const startedAt = performance.now();
  try {
    const db = await getDb();
    await db?.command({ ping: 1 });
    return { status: "ok", latencyMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Math.round(performance.now() - startedAt),
      errorName: error instanceof Error ? error.name : "UnknownError",
    };
  }
}
