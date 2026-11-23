import "server-only";

import crypto from "node:crypto";
import { getServerEnv } from "@/lib/config/env";
import {
  buildStudentKey,
  type SheetSyncRecord,
  type StudentSubmissionRecord,
} from "@/lib/submissions/submissionSchemas";
import {
  NASKAH_CERITA_HEADERS,
  PETA_RANCANG_HEADERS,
  REKAP_NILAI_HEADERS,
  SHEET_TAB_NASKAH,
  SHEET_TAB_PETA,
  SHEET_TAB_REKAP,
  buildNaskahCeritaRow,
  buildPetaRancangRow,
  buildRekapNilaiRow,
  type SheetTabName,
} from "./googleSheetsFormatters";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const NETWORK_TIMEOUT_MS = 10_000;

export type SheetsIntegrationMode =
  | "service_account"
  | "apps_script"
  | "not_configured";

export interface SheetsIntegrationStatus {
  readonly configured: boolean;
  readonly mode: SheetsIntegrationMode;
  readonly defaultSpreadsheetId: string | null;
  readonly spreadsheetUrl: string | null;
}

interface CachedAccessToken {
  readonly token: string;
  readonly expiresAtMs: number;
}

let cachedToken: CachedAccessToken | null = null;
const bootstrappedSpreadsheets = new Set<string>();

export function resetGoogleSheetsRuntimeCachesForTests(): void {
  cachedToken = null;
  bootstrappedSpreadsheets.clear();
}

export function getSheetsIntegrationStatus(
  overrideSpreadsheetId?: string | null
): SheetsIntegrationStatus {
  const env = getServerEnv();
  const spreadsheetId = overrideSpreadsheetId?.trim() || env.GOOGLE_SPREADSHEET_ID || null;
  const hasServiceAccountCreds = Boolean(
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY
  );

  if (hasServiceAccountCreds && spreadsheetId) {
    return {
      configured: true,
      mode: "service_account",
      defaultSpreadsheetId: spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  }

  if (env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL) {
    return {
      configured: true,
      mode: "apps_script",
      defaultSpreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
        : null,
    };
  }

  return {
    configured: false,
    mode: "not_configured",
    defaultSpreadsheetId: spreadsheetId,
    spreadsheetUrl: spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
      : null,
  };
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizePemPrivateKey(rawKey: string): string {
  return rawKey.replace(/\\n/g, "\n").trim();
}

function buildServiceAccountJwt(email: string, rawPrivateKey: string): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: email,
      scope: GOOGLE_SHEETS_SCOPE,
      aud: GOOGLE_OAUTH_TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );

  const signingInput = `${header}.${claimSet}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(normalizePemPrivateKey(rawPrivateKey));
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = NETWORK_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getGoogleAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs) {
    return cachedToken.token;
  }

  const env = getServerEnv();
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_PRIVATE_KEY;
  if (!email || !privateKey) {
    throw new Error("Kredensial Service Account Google Sheets belum dikonfigurasi.");
  }

  const assertion = buildServiceAccountJwt(email, privateKey);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetchWithTimeout(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`OAuth Google gagal (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("Respon OAuth Google tidak mengandung access_token.");
  }

  const expiresInSec = typeof json.expires_in === "number" ? json.expires_in : 3600;
  cachedToken = {
    token: json.access_token,
    // Refresh 5 minutes before actual expiry
    expiresAtMs: Date.now() + Math.max(60, expiresInSec - 300) * 1000,
  };
  return json.access_token;
}

async function sheetsApiRequest<T>(
  accessToken: string,
  spreadsheetId: string,
  pathAndQuery: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}${pathAndQuery}`;
  const res = await fetchWithTimeout(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let reason = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      if (errBody.error?.message) {
        reason = `HTTP ${res.status}: ${errBody.error.message.slice(0, 180)}`;
      }
    } catch {
      // Ignore non-JSON error body
    }
    throw new Error(`Google Sheets API error (${reason})`);
  }

  return (await res.json()) as T;
}

const TAB_HEADER_MAP: Record<SheetTabName, readonly string[]> = {
  [SHEET_TAB_REKAP]: REKAP_NILAI_HEADERS,
  [SHEET_TAB_NASKAH]: NASKAH_CERITA_HEADERS,
  [SHEET_TAB_PETA]: PETA_RANCANG_HEADERS,
};

async function ensureSpreadsheetTabsAndHeaders(
  accessToken: string,
  spreadsheetId: string
): Promise<void> {
  if (bootstrappedSpreadsheets.has(spreadsheetId)) return;

  const meta = await sheetsApiRequest<{
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(accessToken, spreadsheetId, "?fields=sheets.properties.title");

  const existingTitles = new Set(
    (meta.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => typeof t === "string")
  );

  const missingTabs = (
    [SHEET_TAB_REKAP, SHEET_TAB_NASKAH, SHEET_TAB_PETA] as const
  ).filter((tab) => !existingTitles.has(tab));

  if (missingTabs.length > 0) {
    await sheetsApiRequest(accessToken, spreadsheetId, ":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: missingTabs.map((title) => ({
          addSheet: {
            properties: {
              title,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        })),
      }),
    });
  }

  // Ensure row 1 headers exist on each tab without overwriting populated headers
  for (const tab of [SHEET_TAB_REKAP, SHEET_TAB_NASKAH, SHEET_TAB_PETA] as const) {
    const range = encodeURIComponent(`${tab}!A1:B1`);
    const existingRow1 = await sheetsApiRequest<{ values?: string[][] }>(
      accessToken,
      spreadsheetId,
      `/values/${range}`
    );
    const hasHeader = Boolean(existingRow1.values?.[0]?.[0]?.trim());
    if (!hasHeader) {
      const headers = TAB_HEADER_MAP[tab];
      const headerRange = encodeURIComponent(`${tab}!A1`);
      await sheetsApiRequest(
        accessToken,
        spreadsheetId,
        `/values/${headerRange}?valueInputOption=RAW`,
        {
          method: "PUT",
          body: JSON.stringify({ values: [headers] }),
        }
      );
    }
  }

  bootstrappedSpreadsheets.add(spreadsheetId);
}

/**
 * Mencari nomor baris (1-based) milik siswa di suatu tab berdasarkan kecocokan
 * ID Pengumpulan (kolom A) atau kunci identitas siswa (kolom D..G).
 */
async function findExistingStudentRowNumber(
  accessToken: string,
  spreadsheetId: string,
  tab: SheetTabName,
  record: StudentSubmissionRecord
): Promise<number | null> {
  const range = encodeURIComponent(`${tab}!A2:G5000`);
  const data = await sheetsApiRequest<{ values?: string[][] }>(
    accessToken,
    spreadsheetId,
    `/values/${range}`
  );

  const rows = data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowId = (row[0] ?? "").trim();
    if (rowId === record.submissionId) {
      return i + 2;
    }

    const rowClassCode = (row[3] ?? "").trim();
    const rowClass = (row[4] ?? "").trim();
    const rowAbsenRaw = (row[5] ?? "").trim();
    const rowAbsen = rowAbsenRaw === "-" ? "" : rowAbsenRaw;
    const rowName = (row[6] ?? "").trim();

    if (rowName) {
      const rowKey = buildStudentKey({
        classCode: rowClassCode,
        authorClass: rowClass,
        absenNumber: rowAbsen,
        authorName: rowName,
      });
      if (rowKey === record.studentKey) {
        return i + 2;
      }
    }
  }

  return null;
}

function parseAppendedRowNumber(updatedRange?: string): number | null {
  if (!updatedRange) return null;
  const match = updatedRange.match(/![A-Z]+(\d+)(?::[A-Z]+\d+)?$/i);
  if (!match?.[1]) return null;
  const num = Number.parseInt(match[1], 10);
  return Number.isFinite(num) ? num : null;
}

async function upsertRowInTab(params: {
  readonly accessToken: string;
  readonly spreadsheetId: string;
  readonly tab: SheetTabName;
  readonly record: StudentSubmissionRecord;
  readonly rowValues: (string | number)[];
  readonly updateEndColumn: string;
}): Promise<number | null> {
  const existingRow = await findExistingStudentRowNumber(
    params.accessToken,
    params.spreadsheetId,
    params.tab,
    params.record
  );

  if (existingRow !== null) {
    const updateRange = encodeURIComponent(
      `${params.tab}!A${existingRow}:${params.updateEndColumn}${existingRow}`
    );
    await sheetsApiRequest(
      params.accessToken,
      params.spreadsheetId,
      `/values/${updateRange}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values: [params.rowValues] }),
      }
    );
    return existingRow;
  }

  const appendRange = encodeURIComponent(`${params.tab}!A1`);
  const appended = await sheetsApiRequest<{
    updates?: { updatedRange?: string };
  }>(
    params.accessToken,
    params.spreadsheetId,
    `/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [params.rowValues] }),
    }
  );
  return parseAppendedRowNumber(appended.updates?.updatedRange);
}

async function syncViaAppsScriptWebhook(
  record: StudentSubmissionRecord,
  options: { readonly baseUrl?: string | null; readonly writeTeacherColumns: boolean }
): Promise<SheetSyncRecord> {
  const env = getServerEnv();
  const webhookUrl = env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      status: "not_configured",
      syncedAtIso: null,
      lastError: null,
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID ?? null,
      rekapRowNumber: null,
    };
  }

  const payload = {
    secret: env.GOOGLE_APPS_SCRIPT_SECRET ?? "",
    submissionId: record.submissionId,
    studentKey: record.studentKey,
    writeTeacherColumns: options.writeTeacherColumns,
    headers: {
      [SHEET_TAB_REKAP]: REKAP_NILAI_HEADERS,
      [SHEET_TAB_NASKAH]: NASKAH_CERITA_HEADERS,
      [SHEET_TAB_PETA]: PETA_RANCANG_HEADERS,
    },
    rows: {
      [SHEET_TAB_REKAP]: buildRekapNilaiRow(record, {
        baseUrl: options.baseUrl,
        includeTeacherColumns: options.writeTeacherColumns,
      }),
      [SHEET_TAB_NASKAH]: buildNaskahCeritaRow(record),
      [SHEET_TAB_PETA]: buildPetaRancangRow(record),
    },
  };

  const res = await fetchWithTimeout(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Apps Script webhook gagal (HTTP ${res.status}).`);
  }

  return {
    status: "synced",
    syncedAtIso: new Date().toISOString(),
    lastError: null,
    spreadsheetId: env.GOOGLE_SPREADSHEET_ID ?? null,
    rekapRowNumber: null,
  };
}

export interface SyncSubmissionOptions {
  readonly spreadsheetId?: string | null;
  readonly baseUrl?: string | null;
  readonly writeTeacherColumns?: boolean;
}

/**
 * Menyelaraskan satu dokumen pengumpulan siswa ke 3 tab Google Spreadsheet:
 * `Rekap_Nilai`, `Naskah_Cerita`, dan `Peta_Rancang_LKS`.
 *
 * Tidak pernah melempar exception ke caller: kegagalan jaringan/kuota dikembalikan
 * sebagai `{ status: "failed", lastError }` agar data utama di MongoDB tetap aman.
 */
export async function syncSubmissionToGoogleSheets(
  record: StudentSubmissionRecord,
  options: SyncSubmissionOptions = {}
): Promise<SheetSyncRecord> {
  const statusInfo = getSheetsIntegrationStatus(
    options.spreadsheetId ?? record.sheetSync.spreadsheetId
  );

  const hasTeacherGradeOrFeedback =
    record.teacherReview.teacherScore !== null ||
    record.teacherReview.teacherFeedback.trim().length > 0;
  const shouldWriteTeacherCols =
    options.writeTeacherColumns === true || hasTeacherGradeOrFeedback;

  if (!statusInfo.configured) {
    return {
      status: "not_configured",
      syncedAtIso: null,
      lastError: null,
      spreadsheetId: statusInfo.defaultSpreadsheetId,
      rekapRowNumber: null,
    };
  }

  try {
    if (statusInfo.mode === "apps_script") {
      return await syncViaAppsScriptWebhook(record, {
        baseUrl: options.baseUrl,
        writeTeacherColumns: shouldWriteTeacherCols,
      });
    }

    const spreadsheetId = statusInfo.defaultSpreadsheetId!;
    const accessToken = await getGoogleAccessToken();

    try {
      await ensureSpreadsheetTabsAndHeaders(accessToken, spreadsheetId);
    } catch (bootstrapErr) {
      bootstrappedSpreadsheets.delete(spreadsheetId);
      throw bootstrapErr;
    }

    // On existing Rekap_Nilai row, preserve manual teacher columns (Z:AA) unless explicitly updating review
    const existingRekapRow = await findExistingStudentRowNumber(
      accessToken,
      spreadsheetId,
      SHEET_TAB_REKAP,
      record
    );
    const includeTeacherCols = existingRekapRow === null || shouldWriteTeacherCols;
    const rekapRowValues = buildRekapNilaiRow(record, {
      baseUrl: options.baseUrl,
      includeTeacherColumns: includeTeacherCols,
    });

    let rekapRowNumber: number | null;
    if (existingRekapRow !== null) {
      const endCol = includeTeacherCols ? "AA" : "Y";
      const updateRange = encodeURIComponent(
        `${SHEET_TAB_REKAP}!A${existingRekapRow}:${endCol}${existingRekapRow}`
      );
      await sheetsApiRequest(
        accessToken,
        spreadsheetId,
        `/values/${updateRange}?valueInputOption=RAW`,
        {
          method: "PUT",
          body: JSON.stringify({ values: [rekapRowValues] }),
        }
      );
      rekapRowNumber = existingRekapRow;
    } else {
      const appendRange = encodeURIComponent(`${SHEET_TAB_REKAP}!A1`);
      const appended = await sheetsApiRequest<{
        updates?: { updatedRange?: string };
      }>(
        accessToken,
        spreadsheetId,
        `/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          body: JSON.stringify({ values: [rekapRowValues] }),
        }
      );
      rekapRowNumber = parseAppendedRowNumber(appended.updates?.updatedRange);
    }

    await Promise.all([
      upsertRowInTab({
        accessToken,
        spreadsheetId,
        tab: SHEET_TAB_NASKAH,
        record,
        rowValues: buildNaskahCeritaRow(record),
        updateEndColumn: "S",
      }),
      upsertRowInTab({
        accessToken,
        spreadsheetId,
        tab: SHEET_TAB_PETA,
        record,
        rowValues: buildPetaRancangRow(record),
        updateEndColumn: "Q",
      }),
    ]);

    return {
      status: "synced",
      syncedAtIso: new Date().toISOString(),
      lastError: null,
      spreadsheetId,
      rekapRowNumber,
    };
  } catch (error) {
    const rawMsg =
      error instanceof Error ? error.message : "Gagal menyinkronkan ke Google Sheets.";
    return {
      status: "failed",
      syncedAtIso: null,
      lastError: rawMsg.slice(0, 240),
      spreadsheetId: statusInfo.defaultSpreadsheetId,
      rekapRowNumber: record.sheetSync.rekapRowNumber,
    };
  }
}
