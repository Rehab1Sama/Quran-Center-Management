import { Router, type IRouter } from "express";
import { db, circlesTable, usersTable, studentsTable, tracksTable, dataEntryCircleAssignmentsTable, studentEnrollmentsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { CreateCircleBody, UpdateCircleBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/circles", authenticate, async (req, res): Promise<void> => {
  const trackFilter = req.query.track as string | undefined;
  const isArchivedFilter = req.query.isArchived;

  const allCircles = await db.select().from(circlesTable);
  const allTracks = await db.select().from(tracksTable);
  const trackMap: Record<number, string> = {};
  allTracks.forEach(t => { trackMap[t.id] = t.dataEntryType; });

  let circles = allCircles.map(c => ({
    ...c,
    dataEntryType: c.trackId != null ? (trackMap[c.trackId] ?? "girls") : "girls",
  }));

  if (trackFilter) {
    circles = circles.filter(c => c.track === trackFilter);
  }
  if (isArchivedFilter !== undefined) {
    const archived = isArchivedFilter === "true";
    circles = circles.filter(c => c.isArchived === archived);
  }

  // Track supervisors: only their track's circles
  if (req.userRole === "track_supervisor") {
    circles = circles.filter(c => c.track === req.userTrack);
  }

  // Data entry: فقط الحلقات المُسندة لها — وإذا لم يُسند لها شيء ترى الكل
  if (req.userRole === "data_entry") {
    const assignments = await db.select().from(dataEntryCircleAssignmentsTable)
      .where(eq(dataEntryCircleAssignmentsTable.dataEntryUserId, req.userId!));
    if (assignments.length > 0) {
      const assignedIds = new Set(assignments.map(a => a.circleId));
      circles = circles.filter(c => assignedIds.has(c.id));
    }
    // إذا لم يُسند لها حلقات → ترى جميع الحلقات النشطة (سلوك افتراضي)
  }

  // Teachers/supervisors can only see their circle
  if (req.userRole === "teacher" || req.userRole === "supervisor") {
    circles = circles.filter(c => c.id === req.userCircleId);
  }

  res.json(circles);
});

router.post("/circles", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = CreateCircleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [circle] = await db.insert(circlesTable).values(parsed.data).returning();
  res.status(201).json(circle);
});

// Enriched circles — leader/track_supervisor: includes teacher name, supervisor name, student list
router.get("/circles/enriched", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader" && req.userRole !== "track_supervisor") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let circles = await db.select().from(circlesTable).where(eq(circlesTable.isArchived, false));
  if (req.userRole === "track_supervisor") {
    circles = circles.filter(c => c.track === req.userTrack);
  }

  const allUsers = await db.select({
    id: usersTable.id, name: usersTable.name, phone: usersTable.phone,
  }).from(usersTable);
  const userMap: Record<number, { name: string; phone: string | null }> = {};
  allUsers.forEach(u => { userMap[u.id] = { name: u.name, phone: u.phone }; });

  const allEnrollments = await db.select({
    studentId: studentEnrollmentsTable.studentId,
    circleId: studentEnrollmentsTable.circleId,
    fullName: studentsTable.fullName,
    phone: studentsTable.phone,
  })
    .from(studentEnrollmentsTable)
    .innerJoin(studentsTable, eq(studentsTable.id, studentEnrollmentsTable.studentId))
    .where(and(eq(studentEnrollmentsTable.isArchived, false), eq(studentsTable.isArchived, false)));
  const studentsByCircle: Record<number, { id: number; fullName: string }[]> = {};
  for (const e of allEnrollments) {
    if (!studentsByCircle[e.circleId]) studentsByCircle[e.circleId] = [];
    studentsByCircle[e.circleId].push({ id: e.studentId, fullName: e.fullName });
  }

  const enriched = circles.map(c => ({
    ...c,
    teacherName: c.teacherId ? (userMap[c.teacherId]?.name ?? null) : null,
    teacherPhone: c.teacherId ? (userMap[c.teacherId]?.phone ?? null) : null,
    supervisorName: c.supervisorId ? (userMap[c.supervisorId]?.name ?? null) : null,
    supervisorPhone: c.supervisorId ? (userMap[c.supervisorId]?.phone ?? null) : null,
    students: studentsByCircle[c.id] ?? [],
  }));

  res.json(enriched);
});

// Returns minimal circle info (id, name, track) for ALL circles regardless of role — used for transfer selections
router.get("/circles/names", authenticate, async (req, res): Promise<void> => {
  const circles = await db.select({
    id: circlesTable.id,
    name: circlesTable.name,
    track: circlesTable.track,
  }).from(circlesTable).where(eq(circlesTable.isArchived, false));
  res.json(circles);
});

router.get("/circles/:id", authenticate, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  // Permission check
  if (req.userRole === "teacher" || req.userRole === "supervisor") {
    if (req.userCircleId !== id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }
  if (req.userRole === "track_supervisor" || req.userRole === "data_entry") {
    if (circle.track !== req.userTrack) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  let teacher = null, supervisor = null;
  if (circle.teacherId) {
    const [t] = await db.select().from(usersTable).where(eq(usersTable.id, circle.teacherId));
    if (t) {
      const { passwordHash: _ph, ...safe } = t;
      teacher = safe;
    }
  }
  if (circle.supervisorId) {
    const [s] = await db.select().from(usersTable).where(eq(usersTable.id, circle.supervisorId));
    if (s) {
      const { passwordHash: _ph, ...safe } = s;
      supervisor = safe;
    }
  }

  // طالبات عبر سجل التسجيل (المصدر الأساسي)
  const studentsViaEnrollment = await db
    .select({
      id: studentsTable.id,
      fullName: studentsTable.fullName,
      phone: studentsTable.phone,
      country: studentsTable.country,
      ageRange: studentsTable.ageRange,
      educationLevel: studentsTable.educationLevel,
      memorizeFrom: studentsTable.memorizeFrom,
      extraData: studentsTable.extraData,
      isArchived: studentsTable.isArchived,
      isNewcomer: studentsTable.isNewcomer,
      archivedAt: studentsTable.archivedAt,
      circleId: studentEnrollmentsTable.circleId,
      leaveStart: studentEnrollmentsTable.leaveStart,
      leaveEnd: studentEnrollmentsTable.leaveEnd,
      createdAt: studentsTable.createdAt,
      updatedAt: studentsTable.updatedAt,
    })
    .from(studentsTable)
    .innerJoin(
      studentEnrollmentsTable,
      and(
        eq(studentEnrollmentsTable.studentId, studentsTable.id),
        eq(studentEnrollmentsTable.circleId, id),
        eq(studentEnrollmentsTable.isArchived, false),
      ),
    )
    .where(eq(studentsTable.isArchived, false));

  const enrolledIds = new Set(studentsViaEnrollment.map(s => s.id));

  // طالبات لهن circleId مباشرة لكن بدون سجل تسجيل (بيانات قديمة)
  const studentsViaDirect = await db
    .select({
      id: studentsTable.id,
      fullName: studentsTable.fullName,
      phone: studentsTable.phone,
      country: studentsTable.country,
      ageRange: studentsTable.ageRange,
      educationLevel: studentsTable.educationLevel,
      memorizeFrom: studentsTable.memorizeFrom,
      extraData: studentsTable.extraData,
      isArchived: studentsTable.isArchived,
      isNewcomer: studentsTable.isNewcomer,
      archivedAt: studentsTable.archivedAt,
      createdAt: studentsTable.createdAt,
      updatedAt: studentsTable.updatedAt,
    })
    .from(studentsTable)
    .where(and(eq(studentsTable.isArchived, false), eq(studentsTable.circleId, id)));

  // دمج النتيجتين مع منع التكرار
  const studentsRaw: any[] = [...studentsViaEnrollment];
  for (const s of studentsViaDirect) {
    if (!enrolledIds.has(s.id)) {
      studentsRaw.push({ ...s, circleId: id, leaveStart: null, leaveEnd: null });
    }
  }

  res.json({ ...circle, teacher, supervisor, students: studentsRaw });
});

// ── Seed circles for all tracks (10 per track) ─────────────────────────────
const SEED_TRACKS = [
  "بريق", "إشراق", "سُنى", "ضياء", "وهج",
  "مهج", "مشكاة نور", "ألق", "سراج", "قبس", "البهور",
];
const ARABIC_NUMS = ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠"];

router.post("/circles/seed-tracks", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const existing = await db.select({ name: circlesTable.name }).from(circlesTable);
  const existingNames = new Set(existing.map(c => c.name));
  const toInsert: Array<typeof circlesTable.$inferInsert> = [];
  for (const track of SEED_TRACKS) {
    for (let i = 0; i < 10; i++) {
      const name = `${track} ${ARABIC_NUMS[i]}`;
      if (!existingNames.has(name)) {
        toInsert.push({ name, track, trackType: "girls", isArchived: false });
      }
    }
  }
  if (toInsert.length === 0) {
    res.json({ created: 0, message: "جميع الحلقات موجودة مسبقًا" }); return;
  }
  await db.insert(circlesTable).values(toInsert);
  res.json({ created: toInsert.length, message: `تم إنشاء ${toInsert.length} حلقة بنجاح` });
});

router.patch("/circles/:id", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader" && req.userRole !== "track_supervisor") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateCircleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Track supervisors can only edit meetingTime and whatsappLink for their own track's circles
  if (req.userRole === "track_supervisor") {
    const [existing] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
    if (!existing || existing.track !== req.userTrack) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const { meetingTime, whatsappLink } = parsed.data;
    const [updated] = await db.update(circlesTable).set({ meetingTime, whatsappLink }).where(eq(circlesTable.id, id)).returning();
    res.json(updated);
    return;
  }

  const [circle] = await db.update(circlesTable).set(parsed.data).where(eq(circlesTable.id, id)).returning();
  if (!circle) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }
  res.json(circle);
});

export default router;
