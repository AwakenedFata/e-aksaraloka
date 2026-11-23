import "server-only";

import type { Collection, Db, Filter } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import {
  buildStudentKey,
  buildVerifiedSubmissionRecord,
  normalizeClassCode,
  type ClassroomRecord,
  type SheetSyncRecord,
  type StudentSubmissionRecord,
  type SubmitWorkRequestPayload,
  type TeacherReviewUpdatePayload,
  type UpsertClassroomPayload,
} from "./submissionSchemas";

const SUBMISSIONS_COLLECTION = "student_submissions";
const CLASSES_COLLECTION = "classes";

let indexesEnsured = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  try {
    await Promise.all([
      db
        .collection<StudentSubmissionRecord>(SUBMISSIONS_COLLECTION)
        .createIndexes([
          { key: { submissionId: 1 }, unique: true, name: "uniq_submission_id" },
          {
            key: { classCode: 1, studentKey: 1, version: -1 },
            name: "idx_class_student_version",
          },
          {
            key: { isLatest: 1, submittedAtIso: -1 },
            name: "idx_latest_submitted",
          },
          { key: { "sheetSync.status": 1 }, name: "idx_sheet_sync_status" },
        ]),
      db
        .collection<ClassroomRecord>(CLASSES_COLLECTION)
        .createIndexes([
          { key: { classCode: 1 }, unique: true, name: "uniq_class_code" },
        ]),
    ]);
    indexesEnsured = true;
  } catch (err) {
    // Allow retry on next call if transient DB error occurred
    void err;
  }
}

async function getCollections(): Promise<{
  submissions: Collection<StudentSubmissionRecord>;
  classes: Collection<ClassroomRecord>;
} | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureIndexes(db);
  return {
    submissions: db.collection<StudentSubmissionRecord>(SUBMISSIONS_COLLECTION),
    classes: db.collection<ClassroomRecord>(CLASSES_COLLECTION),
  };
}

function stripMongoId<T extends object>(doc: T & { _id?: unknown }): T {
  const copy = { ...doc };
  delete copy._id;
  return copy;
}

export class ClassroomClosedError extends Error {
  constructor(classCode: string) {
    super(`Kode kelas "${classCode}" sudah ditutup oleh guru.`);
    this.name = "ClassroomClosedError";
  }
}

export async function findClassroomByCode(
  classCode: string
): Promise<ClassroomRecord | null> {
  const cols = await getCollections();
  if (!cols) return null;
  const normalized = classCode.trim().toUpperCase();
  if (!normalized) return null;
  const doc = await cols.classes.findOne({ classCode: normalized });
  return doc ? stripMongoId(doc) : null;
}

export async function listClassrooms(): Promise<ClassroomRecord[]> {
  const cols = await getCollections();
  if (!cols) return [];
  const docs = await cols.classes
    .find({})
    .sort({ isActive: -1, classCode: 1 })
    .toArray();
  return docs.map((doc) => stripMongoId(doc));
}

export async function upsertClassroom(
  input: UpsertClassroomPayload
): Promise<ClassroomRecord | null> {
  const cols = await getCollections();
  if (!cols) return null;

  const classCode = input.classCode.trim().toUpperCase();
  const nowIso = new Date().toISOString();
  const existing = await cols.classes.findOne({ classCode });

  const record: ClassroomRecord = {
    classCode,
    className: input.className.trim(),
    teacherName: input.teacherName.trim(),
    spreadsheetId: input.spreadsheetId.trim() || null,
    isActive: input.isActive,
    createdAtIso: existing?.createdAtIso ?? nowIso,
    updatedAtIso: nowIso,
  };

  await cols.classes.updateOne(
    { classCode },
    { $set: record },
    { upsert: true }
  );

  return record;
}

export async function createStudentSubmissionInDb(
  payload: SubmitWorkRequestPayload
): Promise<{
  record: StudentSubmissionRecord;
  classroom: ClassroomRecord | null;
} | null> {
  const cols = await getCollections();
  if (!cols) return null;

  const explicitCode = payload.classCode.trim().toUpperCase();
  let classroom: ClassroomRecord | null = null;
  if (explicitCode) {
    const found = await cols.classes.findOne({ classCode: explicitCode });
    if (found) {
      if (!found.isActive) {
        throw new ClassroomClosedError(explicitCode);
      }
      classroom = stripMongoId(found);
    }
  }

  const resolvedClassCode = normalizeClassCode(
    classroom?.classCode ?? payload.classCode,
    payload.authorClass
  );

  const studentKey = buildStudentKey({
    classCode: resolvedClassCode,
    authorClass: payload.authorClass,
    absenNumber: payload.absenNumber,
    authorName: payload.authorName,
  });

  const previousLatest = await cols.submissions.findOne(
    { studentKey, isLatest: true },
    { sort: { version: -1 } }
  );

  const nextVersion = (previousLatest?.version ?? 0) + 1;
  const record = buildVerifiedSubmissionRecord({
    payload,
    resolvedClassCode,
    version: nextVersion,
    previousTeacherReview: previousLatest?.teacherReview ?? null,
    spreadsheetId: classroom?.spreadsheetId ?? null,
  });

  if (previousLatest) {
    await cols.submissions.updateMany(
      { studentKey, isLatest: true },
      { $set: { isLatest: false } }
    );
  }

  await cols.submissions.insertOne({ ...record });
  return { record, classroom };
}

export async function updateSubmissionSheetSync(
  submissionId: string,
  sheetSync: SheetSyncRecord
): Promise<void> {
  const cols = await getCollections();
  if (!cols) return;
  await cols.submissions.updateOne(
    { submissionId },
    {
      $set: {
        sheetSync,
        updatedAtIso: new Date().toISOString(),
      },
    }
  );
}

export interface ListSubmissionsFilter {
  readonly classCode?: string;
  readonly search?: string;
  readonly syncStatus?: string;
  readonly featuredOnly?: boolean;
  readonly includeHistory?: boolean;
  readonly limit?: number;
}

export async function listSubmissionsFromDb(
  filters: ListSubmissionsFilter = {}
): Promise<StudentSubmissionRecord[]> {
  const cols = await getCollections();
  if (!cols) return [];

  const conditions: Filter<StudentSubmissionRecord>[] = [];
  if (!filters.includeHistory) {
    conditions.push({ isLatest: true });
  }
  if (filters.classCode && filters.classCode !== "ALL") {
    conditions.push({ classCode: filters.classCode.trim().toUpperCase() });
  }
  if (filters.syncStatus && filters.syncStatus !== "ALL") {
    conditions.push({
      "sheetSync.status": filters.syncStatus as SheetSyncRecord["status"],
    });
  }
  if (filters.featuredOnly) {
    conditions.push({ "teacherReview.isFeaturedInGallery": true });
  }
  if (filters.search?.trim()) {
    const escaped = filters.search
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    conditions.push({
      $or: [
        { authorName: rx },
        { authorClass: rx },
        { storyTitle: rx },
        { submissionId: rx },
        { classCode: rx },
      ],
    });
  }

  const query: Filter<StudentSubmissionRecord> =
    conditions.length > 0 ? { $and: conditions } : {};

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  const docs = await cols.submissions
    .find(query)
    .sort({ submittedAtIso: -1 })
    .limit(limit)
    .toArray();

  return docs.map((doc) => stripMongoId(doc));
}

export async function getSubmissionByIdFromDb(
  submissionId: string
): Promise<StudentSubmissionRecord | null> {
  const cols = await getCollections();
  if (!cols) return null;
  const doc = await cols.submissions.findOne({ submissionId });
  return doc ? stripMongoId(doc) : null;
}

export async function getStudentRevisionHistoryFromDb(
  studentKey: string
): Promise<StudentSubmissionRecord[]> {
  const cols = await getCollections();
  if (!cols) return [];
  const docs = await cols.submissions
    .find({ studentKey })
    .sort({ version: -1 })
    .limit(20)
    .toArray();
  return docs.map((doc) => stripMongoId(doc));
}

export async function updateSubmissionTeacherReviewInDb(
  submissionId: string,
  review: TeacherReviewUpdatePayload
): Promise<StudentSubmissionRecord | null> {
  const cols = await getCollections();
  if (!cols) return null;

  const nowIso = new Date().toISOString();
  const updated = await cols.submissions.findOneAndUpdate(
    { submissionId },
    {
      $set: {
        teacherReview: {
          teacherScore: review.teacherScore,
          teacherFeedback: review.teacherFeedback,
          reviewedAtIso: nowIso,
          isFeaturedInGallery: review.isFeaturedInGallery,
        },
        updatedAtIso: nowIso,
      },
    },
    { returnDocument: "after" }
  );

  return updated ? stripMongoId(updated) : null;
}

export async function listPendingOrFailedSyncSubmissionsFromDb(
  submissionId?: string
): Promise<StudentSubmissionRecord[]> {
  const cols = await getCollections();
  if (!cols) return [];

  if (submissionId) {
    const single = await cols.submissions.findOne({ submissionId });
    return single ? [stripMongoId(single)] : [];
  }

  const docs = await cols.submissions
    .find({
      isLatest: true,
      "sheetSync.status": { $in: ["pending", "failed", "not_configured"] },
    })
    .sort({ submittedAtIso: 1 })
    .limit(50)
    .toArray();

  return docs.map((doc) => stripMongoId(doc));
}
