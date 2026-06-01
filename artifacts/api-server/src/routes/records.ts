import { Router, type IRouter } from "express";
import { db, recordsTable, studentsTable, usersTable, reviewPlansTable, circlesTable } from "@workspace/db";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { CreateRecordBody, UpdateRecordBody } from "@workspace/api-zod";
import { checkAndCreateLowMemorizationAlert } from "./lowMemorizationAlerts";

const router: IRouter = Router();

router.get("/records", authenticate, async (req, res): Promise<void> => {
  const { circleId, studentId, date, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

  let records = await db.select().from(recordsTable);

  if (circleId) records = records.filter(r => r.circleId === parseInt(circleId, 10));
  if (studentId) records = records.filter(r => r.studentId === parseInt(studentId, 10));
  if (date) records = records.filter(r => r.date === date);
  if (dateFrom) records = records.filter(r => r.date >= dateFrom);
  if (dateTo) records = records.filter(r => r.date <= dateTo);

  // Enrich with student names
  const sIds = [...new Set(records.map(r => r.studentId))];
  let nameMap: Record<number, string> = {};
  if (sIds.length > 0) {
    const rows = await db.select({ id: studentsTable.id, fullName: studentsTable.fullName })
      .from(studentsTable).where(inArray(studentsTable.id, sIds));
    rows.forEach(s => { nameMap[s.id] = s.fullName; });
  }

  res.json(records.map(r => ({ ...r, studentName: nameMap[r.studentId] ?? "" })));
});

// إدخال يوم الخميس تلقائيًا: مراجعة عامة لكل محفوظ الأحد–الأربعاء
router.post("/records/thursday-bulk", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { date } = req.body as { date?: string };
  if (!date) {
    res.status(400).json({ error: "date is required" });
    return;
  }
  const thursdayDate = new Date(date + "T12:00:00Z");
  if (thursdayDate.getUTCDay() !== 4) {
    res.status(400).json({ error: "يجب أن يكون التاريخ يوم خميس" });
    return;
  }
  // حساب نطاق الأحد–الأربعاء من نفس الأسبوع
  const sundayDate = new Date(thursdayDate.getTime() - 4 * 86400000);
  const wednesdayDate = new Date(thursdayDate.getTime() - 1 * 86400000);
  const dateFrom = sundayDate.toISOString().slice(0, 10);
  const dateTo = wednesdayDate.toISOString().slice(0, 10);

  // جلب جميع الطالبات النشطات
  const students = await db.select().from(studentsTable).where(eq(studentsTable.isArchived, false));
  // سجلات الأسبوع (الأحد–الأربعاء)
  const weekRecords = await db.select().from(recordsTable).where(
    and(gte(recordsTable.date, dateFrom), lte(recordsTable.date, dateTo))
  );
  // سجلات الخميس الموجودة مسبقًا
  const existingThursday = await db.select().from(recordsTable).where(eq(recordsTable.date, date));
  const alreadyEntered = new Set(existingThursday.map(r => r.studentId));

  let created = 0;
  let skipped = 0;

  for (const student of students) {
    if (!student.circleId) { skipped++; continue; }
    if (alreadyEntered.has(student.id)) { skipped++; continue; }

    // سجلات الطالبة التي تحتوي على حفظ جديد هذا الأسبوع
    const memRecords = weekRecords
      .filter(r =>
        r.studentId === student.id &&
        !r.isAbsent &&
        r.memorizeSurahStart != null &&
        (r.memorizePages ?? 0) > 0
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    if (memRecords.length === 0) { skipped++; continue; }

    const firstRec = memRecords[0];
    const lastRec = memRecords[memRecords.length - 1];
    const totalPages = memRecords.reduce((s, r) => s + (r.memorizePages ?? 0), 0);

    await db.insert(recordsTable).values({
      studentId: student.id,
      circleId: student.circleId,
      enteredById: req.userId!,
      date,
      isAbsent: false,
      reviewSurahStart: firstRec.memorizeSurahStart,
      reviewAyahStart: firstRec.memorizeAyahStart,
      reviewSurahEnd: lastRec.memorizeSurahEnd,
      reviewAyahEnd: lastRec.memorizeAyahEnd,
      reviewPages: totalPages,
    });
    created++;
  }

  res.json({ created, skipped });
});

router.get("/records/thursday-history", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const twelveWeeksAgo = new Date(Date.now() - 84 * 86400000);
  const dateFrom = twelveWeeksAgo.toISOString().slice(0, 10);
  const allRecords = await db.select().from(recordsTable).where(gte(recordsTable.date, dateFrom));
  const thursdayRecs = allRecords.filter(r => new Date(r.date + "T12:00:00Z").getUTCDay() === 4);
  const grouped: Record<string, { date: string; count: number; totalPages: number }> = {};
  for (const r of thursdayRecs) {
    if (!grouped[r.date]) grouped[r.date] = { date: r.date, count: 0, totalPages: 0 };
    grouped[r.date].count++;
    grouped[r.date].totalPages += r.reviewPages ?? 0;
  }
  res.json(Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)));
});

router.post("/records/student-self-entry", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "student") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!me) { res.status(403).json({ error: "Forbidden" }); return; }

  const conditions: Parameters<typeof and>[0][] = [eq(studentsTable.fullName, me.name ?? ""), eq(studentsTable.isArchived, false)];
  if (me.circleId) conditions.push(eq(studentsTable.circleId, me.circleId));
  const [student] = await db.select().from(studentsTable).where(and(...conditions));
  if (!student) { res.status(404).json({ error: "لم يتم العثور على سجل الطالبة" }); return; }

  const isOnLeave = !!(student.leaveStart && student.leaveEnd && student.leaveStart <= today && today <= student.leaveEnd);
  if (!isOnLeave) {
    res.status(403).json({ error: "هذه الميزة متاحة فقط للطالبات في إجازة" });
    return;
  }

  const [plan] = await db.select().from(reviewPlansTable)
    .where(and(eq(reviewPlansTable.studentId, student.id), eq(reviewPlansTable.status, "active")));
  if (!plan) { res.status(404).json({ error: "لا توجد خطة مراجعة نشطة" }); return; }

  const {
    status,
    surahStart, ayahStart, surahEnd, ayahEnd, pages,
    stoppedSurah, stoppedAyah, stoppedPages,
    // legacy support
    completed,
  } = req.body as {
    status?: "full" | "partial" | "none";
    surahStart?: string; ayahStart?: number;
    surahEnd?: string; ayahEnd?: number;
    pages?: number;
    stoppedSurah?: string; stoppedAyah?: number; stoppedPages?: number;
    completed?: boolean;
  };

  // Normalise: support both old `completed` bool and new `status` string
  const entryStatus: "full" | "partial" | "none" =
    status ?? (completed === true ? "full" : "none");

  const existing = await db.select().from(recordsTable)
    .where(and(eq(recordsTable.studentId, student.id), eq(recordsTable.date, today)));
  if (existing.length > 0) {
    await db.delete(recordsTable).where(and(eq(recordsTable.studentId, student.id), eq(recordsTable.date, today)));
  }

  const useMemoForTrack = plan.trackType === "simple_review" || plan.trackType === "fixation";

  const baseValues: any = {
    studentId: student.id,
    circleId: student.circleId!,
    enteredById: req.userId!,
    date: today,
    isAbsent: false,
  };

  if (entryStatus === "none") {
    const [record] = await db.insert(recordsTable).values({
      ...baseValues,
      reviewFarPages: 0,
      memorizePages: 0,
    }).returning();
    res.status(201).json({ ...record, performanceStatus: "none" });
    return;
  }

  // "full" or "partial"
  const ss = surahStart ?? null;
  const as_ = ayahStart ?? null;
  const se = entryStatus === "full" ? (surahEnd ?? null) : (stoppedSurah ?? null);
  const ae = entryStatus === "full" ? (ayahEnd ?? null) : (stoppedAyah ?? null);
  const pg = entryStatus === "full" ? (pages ?? 0) : (stoppedPages ?? 0);

  const values: any = { ...baseValues };

  if (useMemoForTrack) {
    values.memorizeSurahStart = ss;
    values.memorizeAyahStart = as_;
    values.memorizeSurahEnd = se;
    values.memorizeAyahEnd = ae;
    values.memorizePages = pg;
  } else {
    values.reviewFarSurahStart = ss;
    values.reviewFarAyahStart = as_;
    values.reviewFarSurahEnd = se;
    values.reviewFarAyahEnd = ae;
    values.reviewFarPages = pg;
  }

  const [record] = await db.insert(recordsTable).values(values).returning();
  res.status(201).json({ ...record, performanceStatus: entryStatus });
});

router.post("/records", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "data_entry"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = CreateRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [record] = await db.insert(recordsTable).values({
    ...parsed.data,
    enteredById: req.userId!,
  }).returning();

  // فحص إنذار قلة الحفظ بعد الإدخال (بشكل غير متزامن لئلا يعيق الاستجابة)
  checkAndCreateLowMemorizationAlert(parsed.data.studentId, req.userId!).catch(() => {});

  res.status(201).json(record);
});

router.patch("/records/:id", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "data_entry"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  // For data_entry: enforce 2-hour edit window
  if (req.userRole === "data_entry") {
    const [existing] = await db.select().from(recordsTable).where(eq(recordsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Record not found" }); return; }
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    if (existing.createdAt < twoHoursAgo) {
      res.status(403).json({ error: "انتهت مدة التعديل (٢ ساعة من وقت الإدخال)" });
      return;
    }
  }

  const parsed = UpdateRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [record] = await db.update(recordsTable).set(parsed.data).where(eq(recordsTable.id, id)).returning();
  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  // فحص إنذار قلة الحفظ بعد التحديث أيضًا (بشكل غير متزامن)
  checkAndCreateLowMemorizationAlert(record.studentId, req.userId!).catch(() => {});

  res.json(record);
});

router.delete("/records/:id", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "data_entry"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(recordsTable).where(eq(recordsTable.id, id));
  res.sendStatus(204);
});

export default router;
