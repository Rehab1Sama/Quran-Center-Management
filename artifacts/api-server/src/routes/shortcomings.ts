import { Router, type IRouter } from "express";
import { db, recordsTable, studentsTable, circlesTable, tracksTable } from "@workspace/db";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { UpdateShortcomingOverrideBody } from "@workspace/api-zod";

const router: IRouter = Router();

const HOURS_48 = 48 * 60 * 60 * 1000;

function computeShortcoming(
  r: typeof recordsTable.$inferSelect,
  trackType?: string | null,
  isFoundational?: boolean,
  studentCreatedAt?: Date | null,
): { isShortcoming: boolean; reasons: string[] } {
  if (r.isAbsent) return { isShortcoming: false, reasons: [] };

  // ── المرحلة التأسيسية — أقل من جزء محفوظ ──────────────────────────────
  if (isFoundational) {
    // اليوم الأول (يوم التسجيل): لا محاسبة
    if (studentCreatedAt) {
      const studentDate = new Date(studentCreatedAt).toISOString().slice(0, 10);
      if (r.date === studentDate) return { isShortcoming: false, reasons: [] };
    }
  }

  const reasons: string[] = [];
  const isRecitation = trackType === "recitation";
  const isChildren   = trackType === "children";
  const isMothers    = trackType === "mothers";

  // مسارات لا تُحاسب على التقصير تلقائياً
  if (isChildren || isMothers || isRecitation) {
    if (r.shortcomingOverride !== null && r.shortcomingOverride !== undefined) {
      return { isShortcoming: r.shortcomingOverride, reasons };
    }
    return { isShortcoming: false, reasons: [] };
  }

  if (!isRecitation) {
    if (isFoundational) {
      // المرحلة التأسيسية: تُحاسب على المراجعة القريبة فقط (لا مراجعة بعيدة)
      if ((r.reviewNearPages ?? 0) === 0) reasons.push("review");
    } else {
      const noReview =
        (r.reviewNearPages ?? 0) === 0 &&
        (r.reviewFarPages ?? 0) === 0 &&
        (r.reviewPages ?? 0) === 0;
      if (noReview) reasons.push("review");
    }
  }

  const notListened = r.listenedToReciter === false;
  if (notListened) reasons.push("listen");

  const autoShortcoming = !isRecitation
    ? (reasons.includes("review") || reasons.includes("listen"))
    : notListened;

  if (r.shortcomingOverride !== null && r.shortcomingOverride !== undefined) {
    return { isShortcoming: r.shortcomingOverride, reasons };
  }
  return { isShortcoming: autoShortcoming, reasons };
}

async function buildShortcomingItem(
  r: typeof recordsTable.$inferSelect,
  studentName: string,
  circleName: string,
  trackName: string,
  trackType?: string | null,
  isFoundational?: boolean,
  studentCreatedAt?: Date | null,
) {
  const { isShortcoming, reasons } = computeShortcoming(r, trackType, isFoundational, studentCreatedAt);
  const ageMs = Date.now() - new Date(r.createdAt).getTime();
  const canEdit = ageMs < HOURS_48;

  return {
    recordId: r.id,
    studentId: r.studentId,
    studentName,
    circleId: r.circleId,
    circleName,
    trackName,
    date: r.date,
    reasons,
    shortcomingOverride: r.shortcomingOverride ?? null,
    isShortcoming,
    canEdit,
    isFoundational: isFoundational ?? false,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /shortcomings — leader sees all, track_supervisor sees their track, teacher sees their circle
router.get("/shortcomings", authenticate, async (req, res): Promise<void> => {
  const role = req.userRole!;
  if (!["leader", "track_supervisor", "teacher", "supervisor"].includes(role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { circleId, trackName, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

  const conditions: Parameters<typeof and>[0][] = [];
  if (dateFrom) conditions.push(gte(recordsTable.date, dateFrom));
  if (dateTo) conditions.push(lte(recordsTable.date, dateTo));

  let records = conditions.length > 0
    ? await db.select().from(recordsTable).where(and(...conditions))
    : await db.select().from(recordsTable);

  records = records.filter(r => !r.isAbsent);

  const allCircles = await db.select().from(circlesTable);
  const allTracks = await db.select().from(tracksTable);

  const circleTrackTypeMap: Record<number, string> = {};
  for (const c of allCircles) {
    if (c.trackId) {
      const t = allTracks.find(t => t.id === c.trackId);
      if (t) circleTrackTypeMap[c.id] = t.dataEntryType;
    } else {
      circleTrackTypeMap[c.id] = c.trackType ?? "girls";
    }
  }

  function getCircleTrackName(cId: number): string {
    const circle = allCircles.find(c => c.id === cId);
    if (!circle?.trackId) return "";
    const track = allTracks.find(t => t.id === circle.trackId);
    return track?.name ?? "";
  }

  if (role === "track_supervisor") {
    const myTrack = req.userTrack ?? "";
    records = records.filter(r => getCircleTrackName(r.circleId) === myTrack);
  } else if (role === "teacher") {
    const myCircleId = req.userCircleId;
    if (myCircleId) records = records.filter(r => r.circleId === myCircleId);
  } else if (role === "supervisor") {
    const myCircleId = req.userCircleId;
    if (myCircleId) records = records.filter(r => r.circleId === myCircleId);
  }

  if (circleId) records = records.filter(r => r.circleId === parseInt(circleId));
  if (trackName) {
    const trackCircleIds = allCircles
      .filter(c => {
        const t = allTracks.find(t => t.id === c.trackId);
        return t?.name === trackName;
      })
      .map(c => c.id);
    records = records.filter(r => trackCircleIds.includes(r.circleId));
  }

  // جلب بيانات جميع الطالبات (بما فيها isNewcomer) قبل الفلترة
  const allStudentIds = [...new Set(records.map(r => r.studentId))];
  const allStudents = allStudentIds.length > 0
    ? await db.select({
        id: studentsTable.id,
        fullName: studentsTable.fullName,
        isNewcomer: studentsTable.isNewcomer,
        createdAt: studentsTable.createdAt,
      }).from(studentsTable).where(inArray(studentsTable.id, allStudentIds))
    : [];
  const studentMap = new Map(allStudents.map(s => [s.id, s]));

  const shortcomingRecords = records.filter(r => {
    const trackType = circleTrackTypeMap[r.circleId];
    const student = studentMap.get(r.studentId);
    const { isShortcoming } = computeShortcoming(
      r, trackType,
      student?.isNewcomer ?? false,
      student?.createdAt ?? null,
    );
    return isShortcoming;
  });

  const result = await Promise.all(
    shortcomingRecords
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(r => {
        const circle = allCircles.find(c => c.id === r.circleId);
        const cTrackName = getCircleTrackName(r.circleId);
        const trackType = circleTrackTypeMap[r.circleId];
        const student = studentMap.get(r.studentId);
        return buildShortcomingItem(
          r,
          student?.fullName ?? "—",
          circle?.name ?? "—",
          cTrackName,
          trackType,
          student?.isNewcomer ?? false,
          student?.createdAt ?? null,
        );
      })
  );

  res.json(result);
});

// PATCH /records/:id/shortcoming — track_supervisor or leader can override
router.patch("/records/:id/shortcoming", authenticate, async (req, res): Promise<void> => {
  const role = req.userRole!;
  if (!["leader", "track_supervisor"].includes(role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const recordId = parseInt(req.params.id as string);
  if (isNaN(recordId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateShortcomingOverrideBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const [record] = await db.select().from(recordsTable).where(eq(recordsTable.id, recordId));
  if (!record) { res.status(404).json({ error: "Record not found" }); return; }

  if (role === "track_supervisor") {
    const ageMs = Date.now() - new Date(record.createdAt).getTime();
    if (ageMs >= HOURS_48) {
      res.status(403).json({ error: "Cannot edit after 48 hours" }); return;
    }
    const myTrack = req.userTrack ?? "";
    const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, record.circleId));
    if (!circle?.trackId) { res.status(403).json({ error: "Forbidden" }); return; }
    const [track] = await db.select().from(tracksTable).where(eq(tracksTable.id, circle.trackId));
    if (track?.name !== myTrack) {
      res.status(403).json({ error: "Circle not in your track" }); return;
    }
  }

  await db.update(recordsTable)
    .set({ shortcomingOverride: body.data.shortcomingOverride })
    .where(eq(recordsTable.id, recordId));

  const [updated] = await db.select().from(recordsTable).where(eq(recordsTable.id, recordId));

  const allCircles = await db.select().from(circlesTable);
  const allTracks = await db.select().from(tracksTable);
  const [student] = await db.select({
    fullName: studentsTable.fullName,
    isNewcomer: studentsTable.isNewcomer,
    createdAt: studentsTable.createdAt,
  }).from(studentsTable).where(eq(studentsTable.id, updated.studentId));
  const circle = allCircles.find(c => c.id === updated.circleId);
  const track = allTracks.find(t => t.id === circle?.trackId);
  const trackType = track?.dataEntryType ?? circle?.trackType ?? "girls";

  const item = await buildShortcomingItem(
    updated,
    student?.fullName ?? "—",
    circle?.name ?? "—",
    track?.name ?? "—",
    trackType,
    student?.isNewcomer ?? false,
    student?.createdAt ?? null,
  );

  res.json(item);
});

export default router;
